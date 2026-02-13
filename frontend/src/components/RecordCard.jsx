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

    window.api
      .getCowboysRecord(year)
      .then((data) => setRecord(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="card"><p className="text-muted">Loading record...</p></div>;
  if (error) return <div className="card"><p style={{ color: "var(--error)" }}>Error: {error}</p></div>;

  return (
    <div className="card">
      <h3>Dallas Cowboys Record {year}</h3>

      <div className="stat-box primary">
        <p className="stat-value" style={{ margin: "1rem 0" }}>
          {record.wins}-{record.losses}-{record.ties}
        </p>

        {("winPct" in record) && (
          <p className="text-small text-muted">
            Win Percentage: <strong>{(record.winPct * 100).toFixed(1)}%</strong>
          </p>
        )}
      </div>
    </div>
  );
}

