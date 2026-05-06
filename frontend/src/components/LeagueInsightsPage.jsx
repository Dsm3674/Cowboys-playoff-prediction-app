import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function LeagueInsightsPage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [divisionPower, setDivisionPower] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [playoffPulse, setPlayoffPulse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.getStandings(year),
      api.getDivisionPower(year),
      api.getLeagueForecast(year),
      api.getPlayoffPulse(year)
    ]).then((results) => {
      if (cancelled) return;
      
      const [s, d, f, p] = results;
      
      if (s.status === "fulfilled") setStandings(s.value.standings);
      if (d.status === "fulfilled") setDivisionPower(d.value.divisions);
      if (f.status === "fulfilled") setForecast(f.value.forecast);
      if (p.status === "fulfilled") setPlayoffPulse(p.value.pulse);
      
      if (results.some(r => r.status === "rejected")) {
        setError("Some league intelligence feeds failed to load. Available modules are still shown below.");
      }
    }).catch((err) => {
      if (!cancelled) setError(err?.message || "Failed to load league intelligence.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const topPlayoffTeams = useMemo(() => (playoffPulse || []).slice(0, 6), [playoffPulse]);
  const topForecastTeams = useMemo(() => (forecast || []).slice(0, 6), [forecast]);

  if (loading) {
    return (
      <div>
        <div className="data-grid three-col" style={{ marginBottom: "1.25rem" }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton-block metric-tile" style={{ height: "80px" }}></div>
          ))}
        </div>
        <div className="skeleton-block" style={{ height: "200px", borderRadius: "8px" }}></div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="key-insight" style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "var(--accent-danger)", marginBottom: "1.25rem" }}>
          {error}
        </div>
      )}

      <div className="data-grid" style={{ marginBottom: "2rem" }}>
        <div>
          <div className="section-label">Top Forecasted Teams</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "400px" }}>
              <thead><tr><th>#</th><th>Team</th><th>Proj Wins</th><th>Proj %</th><th>TSI</th></tr></thead>
              <tbody>
                {topForecastTeams.map((team, i) => (
                  <tr key={team.code}>
                    <td style={{ fontWeight: 700, color: "var(--fg)" }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                    <td>{team.projectedWins}</td>
                    <td className="text-accent" style={{ fontWeight: 600 }}>{team.projectedWinRate}%</td>
                    <td>{team.tsi?.toFixed(1) || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="section-label">Playoff Bubble</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "400px" }}>
              <thead><tr><th>#</th><th>Team</th><th>Playoff %</th><th>TSI</th><th>Win %</th></tr></thead>
              <tbody>
                {topPlayoffTeams.map((team, i) => (
                  <tr key={team.code}>
                    <td style={{ fontWeight: 700, color: "var(--fg)" }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                    <td className="text-accent" style={{ fontWeight: 600 }}>{team.playoffProbability}%</td>
                    <td>{team.tsi?.toFixed(1) || "--"}</td>
                    <td>{team.record ? (team.record.winPct * 100).toFixed(1) : "--"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="data-grid" style={{ marginBottom: "2rem" }}>
        <div>
          <div className="section-label">Division Power Snapshot</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "400px" }}>
              <thead><tr><th>Division</th><th>Avg TSI</th><th>Avg Win %</th><th>Leader</th></tr></thead>
              <tbody>
                {(divisionPower || []).map((d) => (
                  <tr key={`${d.conference}-${d.division}`}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{d.division}</td>
                    <td>{d.averageTSI}</td>
                    <td>{(d.averageWinPct * 100).toFixed(1)}%</td>
                    <td className="text-accent">{d.leader?.code || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {standings && (
          <div>
            <div className="section-label">Conference Leaders</div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {Object.entries(standings).map(([conf, divs]) => (
                <div key={conf}>
                  <h4 style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.5rem 0" }}>{conf} Conference</h4>
                  <div className="data-grid auto-fit" style={{ gap: "0.5rem" }}>
                    {Object.entries(divs).map(([div, teams]) => (
                      <div key={div} className="metric-tile" style={{ padding: "0.6rem 0.85rem" }}>
                        <div className="metric-label" style={{ marginBottom: "0.2rem", fontSize: "0.65rem" }}>{div}</div>
                        {teams.slice(0, 1).map(t => (
                          <div key={t.code} style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)" }}>
                            {t.code} <span style={{ color: "var(--fg-dim)", fontWeight: 400, fontSize: "0.75rem" }}>— {(t.record.winPct * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.LeagueInsightsPage = LeagueInsightsPage;

export default LeagueInsightsPage;
