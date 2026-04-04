const { useEffect, useMemo, useState } = React;

function ConferenceRacePage({ year = new Date().getFullYear() }) {
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
          throw new Error("Unable to load conference standings.");
        }
        setStandings(data.standings);
      })
      .catch((err) => {
        setError(err?.message || "Failed to fetch conference race data.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  const conferenceSummary = useMemo(() => {
    if (!standings) return [];

    return Object.entries(standings).map(([conference, divisions]) => {
      const teams = Object.values(divisions).flat();
      const topTeams = [...teams].sort((a, b) => (b.record.winPct || 0) - (a.record.winPct || 0)).slice(0, 5);
      return { conference, topTeams, divisions, teamCount: teams.length };
    });
  }, [standings]);

  const renderDivision = (divisionName, teams) => (
    <div key={divisionName} className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>{divisionName}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "640px" }}>
          <thead>
            <tr>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Win %</th>
              <th>TSI</th>
              <th>Point Diff</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.code}>
                <td>{team.code}</td>
                <td>{team.record.wins}</td>
                <td>{team.record.losses}</td>
                <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                <td>{team.tsi.toFixed(1)}</td>
                <td>{team.pointDiffPerGame}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <h2>Conference Race</h2>
        <p className="text-muted">Loading the NFC and AFC division races for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Conference Race</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Conference Race</h1>
        <p className="text-small text-muted">
          Track the NFC and AFC races, division leaders, and wildcard contenders with the latest standings and team strength metrics.
        </p>
      </div>

      {conferenceSummary.map((conferenceData) => (
        <section key={conferenceData.conference} style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>{conferenceData.conference}</h2>
              <p className="text-small text-muted">Division race overview and top five teams.</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Top {conferenceData.topTeams.length} Contenders</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "700px" }}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>TSI</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {conferenceData.topTeams.map((team, index) => (
                    <tr key={team.code}>
                      <td>{index + 1}</td>
                      <td>{team.code}</td>
                      <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                      <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                      <td>{team.tsi.toFixed(1)}</td>
                      <td>{team.pointDiffPerGame}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {Object.entries(conferenceData.divisions).map(([divisionName, teams]) => renderDivision(divisionName, teams))}
        </section>
      ))}
    </div>
  );
}

window.ConferenceRacePage = ConferenceRacePage;
