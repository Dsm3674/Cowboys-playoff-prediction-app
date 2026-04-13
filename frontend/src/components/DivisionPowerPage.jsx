const { useEffect, useMemo, useState } = React;

function DivisionPowerPage({ year = new Date().getFullYear() }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    window.api.getDivisionPower(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.divisions)) throw new Error("Missing division power metrics.");
        setDivisions(data.divisions);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load division strength metrics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-block" style={{ height: "160px", borderRadius: "8px", marginBottom: "1rem" }}></div>
        ))}
      </div>
    );
  }

  if (error) return <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}><p className="text-muted">{error}</p></div>;
  if (!divisions.length) return <div className="card"><p className="text-muted">No division power rankings available.</p></div>;

  return (
    <div>
      {divisions.map((division) => (
        <div key={`${division.conference}-${division.division}`} style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{division.division}</h3>
              <span className="text-muted" style={{ fontSize: "0.75rem" }}>{division.conference}</span>
            </div>
            <div className="metric-tile" style={{ padding: "0.5rem 0.85rem" }}>
              <div className="metric-value accent" style={{ fontSize: "1.4rem" }}>{division.averageTSI}</div>
              <div className="metric-label">Avg TSI</div>
            </div>
          </div>

          <div className="data-grid three-col" style={{ marginBottom: "0.75rem", gap: "0.75rem" }}>
            <div className="metric-tile" style={{ padding: "0.75rem 1rem" }}>
              <div className="metric-value" style={{ fontSize: "1.2rem" }}>{(division.averageWinPct * 100).toFixed(1)}%</div>
              <div className="metric-label">Avg Win %</div>
            </div>
            <div className="metric-tile" style={{ padding: "0.75rem 1rem" }}>
              <div className="metric-value" style={{ fontSize: "1.2rem", color: division.averagePointDiff > 0 ? "var(--accent-success)" : "var(--accent-danger)" }}>
                {division.averagePointDiff > 0 ? "+" : ""}{division.averagePointDiff}
              </div>
              <div className="metric-label">Avg Pt Diff</div>
            </div>
            <div className="metric-tile" style={{ padding: "0.75rem 1rem" }}>
              <div className="metric-value text-accent" style={{ fontSize: "1.2rem" }}>{division.leader.code}</div>
              <div className="metric-label">Division Leader</div>
            </div>
          </div>

          <div className="data-table-wrap">
            <table style={{ minWidth: "400px" }}>
              <thead>
                <tr><th>Team</th><th>TSI</th><th>Win %</th><th>Diff</th></tr>
              </thead>
              <tbody>
                {division.teams.map((team) => (
                  <tr key={team.code}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                    <td>{team.tsi.toFixed(1)}</td>
                    <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                    <td style={{ color: team.pointDiffPerGame > 0 ? "var(--accent-success)" : team.pointDiffPerGame < 0 ? "var(--accent-danger)" : "var(--muted)" }}>
                      {team.pointDiffPerGame > 0 ? "+" : ""}{team.pointDiffPerGame}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

window.DivisionPowerPage = DivisionPowerPage;
