function TSICard({ year }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    window.api.getTSI("DAL", year)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="card">Loading TSI...</div>;
  if (!data) return null;

  const tsiColor = data.tsi >= 55 ? "#059669" : data.tsi >= 45 ? "#d97706" : "#dc2626";

  return (
    <div className="card">
      <div className="eyebrow">Team Strength Index</div>
      <h3 style={{ marginTop: 0 }}>Cowboys Power Rating</h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          color: tsiColor,
          lineHeight: 1
        }}>
          {data.tsi}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          / 100<br/>Scale
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
        <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>Offense:</strong> {data.components.offense}
        </div>
        <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>Defense:</strong> {data.components.defense}
        </div>
        <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>Schedule:</strong> {data.components.schedule}
        </div>
        <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>QB Adj:</strong> {data.components.qbAdj}
        </div>
      </div>
    </div>
  );
}

// Export to global scope for main.jsx
window.TSICard = TSICard;
