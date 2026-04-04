const { useEffect, useState } = React;

function PlayoffPulsePage({ year = new Date().getFullYear() }) {
  const [pulse, setPulse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    window.api
      .getPlayoffPulse(year)
      .then((data) => {
        if (!data || !Array.isArray(data.pulse)) {
          throw new Error("No playoff pulse data available.");
        }
        setPulse(data.pulse);
      })
      .catch((err) => {
        setError(err?.message || "Unable to load playoff pulse.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="card">
        <h2>Playoff Pulse</h2>
        <p className="text-muted">Calculating odds and bubble teams for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Playoff Pulse</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  const topBubble = pulse.slice(0, 12);

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Playoff Pulse</h1>
        <p className="text-small text-muted">
          Ranked playoff outlook for every team in the league, based on current record and projected performance.
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Current Playoff Favorites</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "680px" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>Prob</th>
                <th>TSI</th>
                <th>Win %</th>
                <th>Avg. Diff</th>
              </tr>
            </thead>
            <tbody>
              {topBubble.map((team, index) => (
                <tr key={team.code}>
                  <td>{index + 1}</td>
                  <td>{team.code}</td>
                  <td>{team.playoffProbability}%</td>
                  <td>{team.tsi.toFixed(1)}</td>
                  <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                  <td>{team.averagePointDiff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Full League Playoff Outlook</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "760px" }}>
            <thead>
              <tr>
                <th>Team</th>
                <th>Conf</th>
                <th>Div</th>
                <th>Playoff %</th>
                <th>TSI</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {pulse.map((team) => (
                <tr key={team.code}>
                  <td>{team.code}</td>
                  <td>{team.conference}</td>
                  <td>{team.division}</td>
                  <td>{team.playoffProbability}%</td>
                  <td>{team.tsi.toFixed(1)}</td>
                  <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PlayoffPulsePage = PlayoffPulsePage;
