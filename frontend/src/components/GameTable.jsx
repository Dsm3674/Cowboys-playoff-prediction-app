function GameTable({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    
    window.getCowboysSchedule(year)
      .then((data) => {
        console.log('Schedule data:', data);
        setGames(data.games || []);
      })
      .catch((err) => {
        console.error('Error loading schedule:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="loading">Loading schedule...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!games.length) return <div>No games found for {year}</div>;

  return (
    <div style={{ background: "white", padding: "1rem", borderRadius: "10px", marginTop: "1rem" }}>
      <h2>Schedule</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }}>Home</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }}>Away</th>
            <th style={{ textAlign: "center", padding: "8px", borderBottom: "2px solid #ddd" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g, idx) => (
            <tr key={idx}>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {g.homeTeam?.displayName || g.homeTeam?.name || 'Unknown'}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                {g.awayTeam?.displayName || g.awayTeam?.name || 'Unknown'}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                {g.homeScore} - {g.awayScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
