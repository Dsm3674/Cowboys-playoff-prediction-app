function MustWinCard({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    window.api.getMustWin("DAL", year, 0)
      .then(res => setGames(res.games || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return null;
  if (!games.length) return null;

  // Take top 3 most important games
  const topGames = games.slice(0, 3);

  return (
    <div className="card" style={{ borderLeft: '4px solid #d20a0a' }}>
      <h3 style={{ marginTop: 0, color: '#d20a0a' }}>High Leverage Games</h3>
      <p style={{ fontSize: '0.8rem', color: '#555' }}>
        These matchups have the biggest impact on playoff probability.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        {topGames.map((g, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: '#fff',
            border: '1px solid #eee',
            padding: '0.5rem',
            borderRadius: '6px'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>vs {g.opp}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                {new Date(g.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                background: '#fee2e2', 
                color: '#991b1b', 
                fontSize: '0.75rem', 
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {(g.swing * 100).toFixed(1)}% Swing
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.MustWinCard = MustWinCard;
