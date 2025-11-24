function RecordCard({ year }) {
  const [record, setRecord] = React.useState({
    wins: 0,
    losses: 0,
    ties: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    window
      .getCowboysRecord(year)
      .then((data) => setRecord(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div>Loading record...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div
      style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "10px",
        marginTop: "1rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <h2>Dallas Cowboys Record {year}</h2>

      <p
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          color: "#003594",
        }}
      >
        {record.wins}-{record.losses}-{record.ties}
      </p>

      {"winPct" in record && (
        <p style={{ color: "#666" }}>
          Win Percentage: {(record.winPct * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

