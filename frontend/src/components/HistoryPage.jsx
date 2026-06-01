import React from "react";
import { api } from "../api";

function HistoryPage() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [account, setAccount] = React.useState("");

  function getSignedInAccount() {
    try {
      const stored = JSON.parse(localStorage.getItem("cowboys_iq_auth_v3") || "null");
      return /^[^@\s]+@gmail\.com$/i.test(stored?.user || "")
        ? stored.user.trim().toLowerCase()
        : "";
    } catch (_err) {
      return "";
    }
  }

  React.useEffect(() => {
    setAccount(getSignedInAccount());
    setLoading(true);
    setError(null);

    api
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
        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
          Track how playoff, division, conference and Super Bowl odds have shifted
          over time for your account only. This history is scoped to your signed-in
          Gmail and this browser cookie, not shared across every visitor.
        </p>
        <div className="intel-chip intel-chip--muted" style={{ marginBottom: "1rem" }}>
          {account ? `Private history: ${account}` : "Private browser history"}
        </div>

        {loading && <p>Loading your private history…</p>}

        {/* FIX: error only shows if fetch failed */}
        {!loading && error && (
          <p style={{ color: "red" }}>{error}</p>
        )}

        {/* FIX: clean empty-state */}
        {!loading && !error && rows.length === 0 && (
          <p className="text-muted" style={{ fontStyle: "italic" }}>
            No private predictions yet. Run a simulation while signed in to start
            building your own history.
          </p>
        )}

        {/* FIX: defensive rendering */}
        {!loading && !error && rows.length > 0 && (
          <div className="history-table-wrap">
            <div className="history-table-meta">
              {rows.length} prediction{rows.length === 1 ? "" : "s"} logged
            </div>
            <table className="history-table" style={{ width: "100%", borderCollapse: "collapse" }}>
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
          </div>
        )}
      </div>
    </div>
  );
}

window.HistoryPage = HistoryPage;

export default HistoryPage;
