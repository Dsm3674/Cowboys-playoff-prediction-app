const { useEffect, useState } = React;

function LeagueForecastPage({ year = new Date().getFullYear() }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    window.api
      .getLeagueForecast(year)
      .then((data) => {
        if (!data || !Array.isArray(data.forecast)) {
          throw new Error("Forecast data is unavailable.");
        }
        setForecast(data.forecast);
      })
      .catch((err) => {
        setError(err?.message || "Unable to load the league forecast.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  const topTeams = forecast.slice(0, 10);

  if (loading) {
    return (
      <div className="card">
        <h2>League Forecast</h2>
        <p className="text-muted">Building the projected league leaderboard for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>League Forecast</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>League Forecast</h1>
        <p className="text-small text-muted">
          Projected team performance for the remainder of the season based on current record, TSI, and remaining schedule.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Top 10 Forecasted Teams</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "640px" }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Current Record</th>
                  <th>Projected Wins</th>
                  <th>Projected %</th>
                  <th>TSI</th>
                </tr>
              </thead>
              <tbody>
                {topTeams.map((team, index) => (
                  <tr key={team.code}>
                    <td>{index + 1}</td>
                    <td>{team.code}</td>
                    <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                    <td>{team.projectedWins}</td>
                    <td>{team.projectedWinRate}%</td>
                    <td>{team.tsi.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Forecast Leaderboard</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "760px" }}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Conference</th>
                  <th>Division</th>
                  <th>Current Win %</th>
                  <th>Projected Wins</th>
                  <th>Remaining</th>
                  <th>Projection Score</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((team) => (
                  <tr key={team.code}>
                    <td>{team.code}</td>
                    <td>{team.conference}</td>
                    <td>{team.division}</td>
                    <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                    <td>{team.projectedWins}</td>
                    <td>{team.remainingGames}</td>
                    <td>{team.projectionScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

window.LeagueForecastPage = LeagueForecastPage;
