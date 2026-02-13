function GameTable({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    window.api
      .getCowboysSchedule(year)
      .then((data) => {
        setGames(data.games || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="card"><p className="text-muted">Loading schedule...</p></div>;
  if (error) return <div className="card"><p style={{ color: "var(--error)" }}>Error: {error}</p></div>;
  if (!games.length) return <div className="card"><p className="text-muted">No games found for {year}</p></div>;

  return (
    <div className="card">
      <h3>Schedule</h3>

      <table>
        <thead>
          <tr>
            <th>Home</th>
            <th>Away</th>
            <th style={{ textAlign: "center" }}>Score</th>
          </tr>
        </thead>

        <tbody>
          {games.map((g, i) => (
            <tr key={i}>
              <td>{g.homeTeamName}</td>
              <td>{g.awayTeamName}</td>
              <td style={{ textAlign: "center" }}>
                {g.homeScore} - {g.awayScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
