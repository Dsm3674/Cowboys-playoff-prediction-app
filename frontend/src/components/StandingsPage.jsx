const { useEffect, useState } = React;

function StandingsPage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    window.api
      .getStandings(year)
      .then((data) => {
        if (!data || !data.standings) {
          throw new Error("Unable to load standings.");
        }
        setStandings(data.standings);
      })
      .catch((err) => {
        setError(err?.message || "Failed to fetch league standings.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="card">
        <h2>League Standings</h2>
        <p className="text-muted">Loading the full NFL standings for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>League Standings</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (!standings || Object.keys(standings).length === 0) {
    return (
      <div className="card">
        <h2>League Standings</h2>
        <p className="text-muted">No standings are available for {year}.</p>
      </div>
    );
  }

  const renderDivisionTable = (divisionName, teams) => (
    <div key={divisionName} className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>{divisionName}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "620px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Team</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>Win %</th>
              <th>TSI</th>
              <th>PF</th>
              <th>PA</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.code}>
                <td style={{ textAlign: "left", fontWeight: 600 }}>{team.code}</td>
                <td>{team.record.wins}</td>
                <td>{team.record.losses}</td>
                <td>{team.record.ties}</td>
                <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                <td>{team.tsi.toFixed(1)}</td>
                <td>{team.avgFor}</td>
                <td>{team.avgAgainst}</td>
                <td>{team.pointDiffPerGame}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>NFL Standings</h1>
        <p className="text-small text-muted">
          Explore team rankings across each conference and division using live record, average performance, and TSI.
        </p>
      </div>

      {Object.entries(standings).map(([conference, divisions]) => (
        <section key={conference} style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>{conference} Conference</h2>
          </div>
          {Object.entries(divisions).map(([division, teams]) => renderDivisionTable(division, teams))}
        </section>
      ))}
    </div>
  );
}

window.StandingsPage = StandingsPage;
