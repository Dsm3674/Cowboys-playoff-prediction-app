import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import Chart from "chart.js/auto";

/* ── Sparkline Component ────────────────────────────────────────────── */
function Sparkline({ data, color = "#00d4aa" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !Chart) return;
    
    let actualColor = color;
    if (color === "var(--accent)") actualColor = "#00d4aa";
    if (color === "var(--accent-success)") actualColor = "#10b981";

    const ctx = canvasRef.current.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 40);
    // Rough parse for rgba gradient base
    const r = parseInt(actualColor.slice(1, 3), 16) || 0;
    const g = parseInt(actualColor.slice(3, 5), 16) || 212;
    const b = parseInt(actualColor.slice(5, 7), 16) || 170;
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data: data,
          borderColor: actualColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          backgroundColor: gradient,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: Math.min(...data) * 0.9, max: Math.max(...data) * 1.1 }
        },
        layout: { padding: 0 }
      }
    });

    return () => chart.destroy();
  }, [data, color]);

  return <div style={{ height: "40px", width: "100%", marginTop: "0.75rem" }}><canvas ref={canvasRef}></canvas></div>;
}

function DetailedTeamProfilePage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [record, setRecord] = useState(null);
  const [tsi, setTsi] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [mustWin, setMustWin] = useState([]);
  const [paths, setPaths] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setRecord(null); setTsi(null); setSchedule([]); setMustWin([]); setPaths(null);

    Promise.allSettled([
      api.getRecord(year, selectedTeam),
      api.getTSI(selectedTeam, year),
      api.getSchedule(year, selectedTeam),
      api.getMustWin(selectedTeam, year),
      api.getPaths(selectedTeam, year, 12, 0)
    ]).then((results) => {
      if (cancelled) return;

      const [r, t, s, m, p] = results;

      if (r.status === "fulfilled") setRecord(r.value);
      if (t.status === "fulfilled") setTsi(t.value);
      if (s.status === "fulfilled") setSchedule(s.value.games || []);
      if (m.status === "fulfilled") setMustWin(m.value.games || []);
      if (p.status === "fulfilled") setPaths(p.value);

      if (results.some(x => x.status === "rejected")) {
        setError("Some team profile data could not be loaded.");
      }
    }).catch((err) => {
      if (!cancelled) setError(err?.message || "Failed to load profile data.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [year, selectedTeam]);

  const upcoming = useMemo(() => schedule.filter(g => !g.completed).slice(0, 5), [schedule]);
  const topMustWin = useMemo(() => mustWin.slice(0, 3), [mustWin]);
  const pathRows = useMemo(() => (paths?.paths || []).slice(0, 5), [paths]);

  if (loading) {
    return (
      <div>
        <div className="data-grid three-col" style={{ marginBottom: "1.25rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton-block metric-tile" style={{ height: "90px" }}></div>)}
        </div>
        <div className="skeleton-block" style={{ height: "200px", borderRadius: "8px" }}></div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="key-insight" style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "var(--accent-danger)", marginBottom: "1.25rem" }}>{error}</div>}

      <div className="data-grid three-col" style={{ marginBottom: "1.75rem" }}>
        <div className="metric-tile">
          <div className="metric-value accent">{record ? `${record.wins}-${record.losses}-${record.ties}` : "—"}</div>
          <div className="metric-label">Current Record</div>
          {record && typeof record.winPct === "number" && <div className="metric-sub">Win %: {(record.winPct * 100).toFixed(1)}%</div>}
        </div>
        <div className="metric-tile">
          <div className="metric-value">{tsi ? tsi.tsi : "—"}</div>
          <div className="metric-label">Team Strength Index</div>
          {tsi && <Sparkline data={[10.2, 11.5, 11.1, 12.8, 13.5, 13.0, 14.1]} color="var(--accent)" />}
        </div>
        <div className="metric-tile">
          <div className="metric-value">{paths?.paths?.[0] ? `${(paths.paths[0].probability * 100).toFixed(1)}%` : "—"}</div>
          <div className="metric-label">Path Confidence</div>
          {paths?.paths?.[0] && <Sparkline data={[45, 48, 52, 50, 58, 65, 71]} color="var(--accent-success)" />}
        </div>
      </div>

      <div className="data-grid" style={{ marginBottom: "1.75rem" }}>
        <div>
          <div className="section-label">Upcoming Schedule</div>
          {upcoming.length ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {upcoming.map((game, i) => (
                <div key={i} className="metric-tile" style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {game.homeTeamAbbr === selectedTeam ? "vs " : "@ "}{game.homeTeamAbbr === selectedTeam ? game.awayTeamAbbr : game.homeTeamAbbr}
                    </div>
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>{new Date(game.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted">No upcoming games.</p>}
        </div>

        <div>
          <div className="section-label">Must-Win Games</div>
          {topMustWin.length ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {topMustWin.map((game, i) => (
                <div key={i} className="metric-tile" style={{ padding: "0.75rem 1rem", borderLeft: "3px solid var(--accent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>vs {game.opp}</div>
                    <span className="text-accent" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                      {(game.swing * 100).toFixed(1)}% swing
                    </span>
                  </div>
                  <div className="metric-sub">{new Date(game.date).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted">No high-leverage games identified.</p>}
        </div>
      </div>

      {pathRows.length > 0 && (
        <div>
          <div className="section-label">Projected Season Paths</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "500px" }}>
              <thead><tr><th>Rank</th><th>Probability</th><th>Wins Added</th><th>Path</th></tr></thead>
              <tbody>
                {pathRows.map((path, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: "var(--fg)" }}>{i + 1}</td>
                    <td className="text-accent" style={{ fontWeight: 600 }}>{(path.probability * 100).toFixed(1)}%</td>
                    <td>{path.winsAdded}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--fg-dim)" }}>{(path.outcomes || []).map(o => o.result).join("-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

window.DetailedTeamProfilePage = DetailedTeamProfilePage;

export default DetailedTeamProfilePage;
