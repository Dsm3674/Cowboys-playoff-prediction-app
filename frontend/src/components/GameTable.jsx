function GameTable({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getCowboysSchedule(year)
      .then((data) => setGames(data.games))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div>Loading schedule...</div>;

  return (
    <div style={{ background: "white", padding: "1rem", borderRadius: "10px" }}>
      <table>
        <thead>
          <tr>
            <th>Week</th><th>Date</th><th>Opponent</th><th>Score</th><th>Result</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td>{g.week}</td>
              <td>{new Date(g.date).toLocaleDateString()}</td>
              <td>{g.opponent}</td>
              <td>{g.teamScore} - {g.oppScore}</td>
              <td>{g.result ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
