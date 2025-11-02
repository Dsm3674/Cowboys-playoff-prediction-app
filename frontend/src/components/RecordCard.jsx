function RecordCard({ year }) {
  const [record, setRecord] = React.useState({ wins: 0, losses: 0, ties: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    
    window.getCowboysRecord(year)
      .then(data => {
        console.log('Record data:', data);
        setRecord(data);
      })
      .catch(err => {
        console.error('Error loading record:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="loading">Loading record...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div style={{ 
      background: "white", 
      padding: "1.5rem", 
      borderRadius: "10px", 
      marginTop: "1rem",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ margin: "0 0 1rem 0" }}>Dallas Cowboys Record {year}</h2>
      <p style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: "#003594" }}>
        {record.wins}-{record.losses}-{record.ties}
      </p>
      {record.winPct !== undefined && (
        <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
          Win Percentage: {(record.winPct * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}
