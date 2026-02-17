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
        // FIX: always normalize to array
        setRows(Array.isArray(data.history) ? data.history : []);
      })
      .catch((err) => {
        // FIX: only show error if fetch truly failed
        console.error("History fetch failed:", err);
        setError("Failed to load prediction history.");
        setRows([]);
      })
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

        {/* FIX: error only shows if fetch failed */}
        {!loading && error && (
          <p style={{ color: "red" }}>{error}</p>
        )}

        {/* FIX: clean empty-state */}
        {!loading && !error && rows.length === 0 && (
          <p style={{ fontStyle: "italic", color: "#666" }}>
            No historical predictions yet. Run a simulation to start building
            the story.
          </p>
        )}

        {/* FIX: defensive rendering */}
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
              {rows.map((r, idx) => {
                const pct = (v) =>
                  typeof v === "number" ? (v * 100).toFixed(1) + "%" : "—";

                const dateStr = r.prediction_date
                  ? new Date(r.prediction_date).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <tr key={idx}>
                    <td
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "8px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {dateStr}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                      {pct(r.playoff_probability)}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                      {pct(r.division_probability)}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                      {pct(r.conference_probability)}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                      {pct(r.superbowl_probability)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

window.HistoryPage = HistoryPage;
