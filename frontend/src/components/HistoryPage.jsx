function HistoryPage() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    window.api
      .getPredictionHistory()
      .then((data) => {
        setRows(data.history || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="content-area">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Our Story: Prediction History</h2>
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Track how playoff, division, conference and Super Bowl odds have
          shifted over time for the Cowboys.
        </p>

        {loading && <p>Loading history…</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        {!loading && !error && rows.length === 0 && (
          <p style={{ fontStyle: "italic", color: "#666" }}>
            No historical predictions found yet. Run some simulations from the
            dashboard to start building a history.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Date
                </th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Playoffs
                </th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Division
                </th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Conference
                </th>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Super Bowl
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "8px",
                      fontSize: "0.85rem",
                    }}
                  >
                    {new Date(r.prediction_date).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {(r.playoff_probability * 100).toFixed(1)}%
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {(r.division_probability * 100).toFixed(1)}%
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {(r.conference_probability * 100).toFixed(1)}%
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {(r.superbowl_probability * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
