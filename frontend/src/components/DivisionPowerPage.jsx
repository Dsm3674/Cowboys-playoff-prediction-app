const { useEffect, useState } = React;

function DivisionPowerPage({ year = new Date().getFullYear() }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    window.api
      .getDivisionPower(year)
      .then((data) => {
        if (!data || !Array.isArray(data.divisions)) {
          throw new Error("Missing division power metrics.");
        }
        setDivisions(data.divisions);
      })
      .catch((err) => {
        setError(err?.message || "Unable to load division strength metrics.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="card">
        <h2>Division Power Rankings</h2>
        <p className="text-muted">Loading division strength metrics for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Division Power Rankings</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (divisions.length === 0) {
    return (
      <div className="card">
        <h2>Division Power Rankings</h2>
        <p className="text-muted">No division power rankings are available yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Division Power Rankings</h1>
        <p className="text-small text-muted">
          Compare each division by average TSI, league win percentage, and overall point differential.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {divisions.map((division) => (
          <div key={`${division.conference}-${division.division}`} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0 }}>{division.division}</h2>
                <p className="text-small text-muted" style={{ margin: 0 }}>{division.conference}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{division.averageTSI}</div>
                <div className="text-small text-muted">Avg. TSI</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem" }}>
                <strong>Avg. Win %</strong>
                <div>{(division.averageWinPct * 100).toFixed(1)}%</div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem" }}>
                <strong>Avg. Point Diff</strong>
                <div>{division.averagePointDiff}</div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem" }}>
                <strong>Division Leader</strong>
                <div>{division.leader.code}</div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "560px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Team</th>
                    <th>TSI</th>
                    <th>Win %</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {division.teams.map((team) => (
                    <tr key={team.code}>
                      <td style={{ fontWeight: 600 }}>{team.code}</td>
                      <td>{team.tsi.toFixed(1)}</td>
                      <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                      <td>{team.pointDiffPerGame}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.DivisionPowerPage = DivisionPowerPage;
