function GameTable({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    window
      .getCowboysSchedule(year)
      .then((data) => {
        setGames(data.games || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div>Loading schedule...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!games.length) return <div>No games found for {year}</div>;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Schedule</h2>

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
