function App() {
  const yearNow = new Date().getFullYear();
  const [year, setYear] = React.useState(yearNow);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());
  const [prediction, setPrediction] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [loadingPrediction, setLoadingPrediction] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Fetch prediction + history
  async function loadPredictionData() {
    try {
      setLoadingPrediction(true);
      setError(null);

      const [predRes, histRes] = await Promise.all([
        window.getCurrentPrediction(),
        window.getPredictionHistory(),
      ]);

      setPrediction(predRes.prediction);
      setHistory(histRes.history || []);
      console.log("Prediction loaded:", predRes);
    } catch (err) {
      console.error("Prediction error:", err);
      setError(err.message);
    } finally {
      setLoadingPrediction(false);
    }
  }

  React.useEffect(() => {
    loadPredictionData();
  }, [refreshKey]);

  // Auto-refresh every 2 minutes
  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log("Auto-refreshing data...");
      setRefreshKey((prev) => prev + 1);
      setLastUpdate(new Date());
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Cowboys Playoff Prediction App</h1>
      <p>Live record, stats, and predictions</p>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <label>
          <strong>Season:</strong>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              marginLeft: "0.5rem",
              padding: "0.25rem",
              width: "80px",
            }}
          />
        </label>

        <button
          onClick={() => {
            setRefreshKey((prev) => prev + 1);
            setLastUpdate(new Date());
          }}
          style={{
            padding: "0.5rem 1rem",
            background: "#003594",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          🔄 Refresh Now
        </button>

        <small style={{ color: "#666" }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </small>
      </div>

      <RecordCard year={year} key={`record-${year}-${refreshKey}`} />
      <GameTable year={year} key={`games-${year}-${refreshKey}`} />

      {/* ======================= */}
      {/* NEW: Prediction Section */}
      {/* ======================= */}
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "10px",
          marginTop: "1.5rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ margin: 0 }}>Playoff Prediction</h2>
        {loadingPrediction ? (
          <p>Loading prediction...</p>
        ) : error ? (
          <p style={{ color: "red" }}>Error: {error}</p>
        ) : prediction ? (
          <div style={{ marginTop: "1rem" }}>
            <p>
              <strong>Playoff Chance:</strong> {(prediction.playoffs * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Division Chance:</strong> {(prediction.division * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Conference Chance:</strong> {(prediction.conference * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Super Bowl Chance:</strong> {(prediction.superBowl * 100).toFixed(1)}%
            </p>
            {prediction.generatedAt && (
              <p style={{ fontSize: "0.8rem", color: "#777" }}>
                Generated: {new Date(prediction.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p>No prediction data.</p>
        )}
      </div>

      {/* ======================= */}
      {/* NEW: Prediction History */}
      {/* ======================= */}
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "10px",
          marginTop: "1.5rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ margin: 0 }}>Prediction Archive</h2>
        {history.length === 0 ? (
          <p>Building prediction history...</p>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {history.map((pred, i) => (
              <li
                key={i}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "0.5rem 0",
                }}
              >
                <strong>{new Date(pred.generatedAt).toLocaleString()}</strong>
                <br />
                🏈 Playoffs: {(pred.playoffs * 100).toFixed(1)}% |
                Division: {(pred.division * 100).toFixed(1)}% |
                Conference: {(pred.conference * 100).toFixed(1)}% |
                Super Bowl: {(pred.superBowl * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
