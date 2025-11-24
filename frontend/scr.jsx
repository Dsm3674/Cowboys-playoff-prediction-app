// =========================================
// COMPONENT: PredictionPanel
// =========================================
function PredictionPanel() {
  const [pred, setPred] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchPrediction = () => {
    setLoading(true);
    setError(null);

    window
      .generatePrediction()
      .then((data) => {
        if (data.success) setPred(data.prediction);
        else setError("Prediction service returned no result");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div
      style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "10px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Playoff Odds (AI Model)</h3>

        <button
          onClick={fetchPrediction}
          disabled={loading}
          style={{
            background: "#003594",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#d00", marginTop: 0 }}>{error}</p>
      )}

      {!pred ? (
        <p style={{ fontStyle: "italic", color: "#666" }}>
          Run the simulation to see playoff odds.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <div
            style={{
              background: "#f0f9ff",
              padding: "1rem",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#555" }}>Make Playoffs</div>
            <div
              style={{
                fontSize: "1.6rem",
                color: "#003594",
                fontWeight: "bold",
              }}
            >
              {(pred.playoff_probability * 100).toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              background: "#fff0f0",
              padding: "1rem",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#555" }}>Super Bowl</div>
            <div
              style={{
                fontSize: "1.6rem",
                color: "#d20a0a",
                fontWeight: "bold",
              }}
            >
              {(pred.superbowl_probability * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================
// COMPONENT: What-If Scenario Simulator
// =========================================
function WhatIfSimulator() {
  const [modelType, setModelType] = React.useState("RandomForest");
  const [scenario, setScenario] = React.useState("");
  const [iterations, setIterations] = React.useState(500);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const runSim = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      modelType,
      scenario: scenario || null,
      iterations: Number(iterations) || 500,
    };

    window
      .runWhatIfSimulation(payload)
      .then((data) => {
        if (!data.success) {
          setError("Simulation failed on server");
          return;
        }
        setResult(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const niceScenario = (code) => {
    if (!code) return "Baseline Season";
    if (code === "injury_qb") return "QB Injury Shock";
    if (code === "easy_schedule") return "Soft Schedule Advantage";
    if (code === "weather_snow") return "Snow Game Chaos";
    return code;
  };

  return (
    <div
      style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "10px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>AI Story Simulator</h3>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        Explore “What If?” season outcomes using AI + Monte Carlo simulation.
      </p>

      <form onSubmit={runSim}>
        <div className="form-group">
          <label>Model Type:</label>
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
          >
            <option value="RandomForest">Random Forest</option>
            <option value="Elo">Elo Rating Model</option>
            <option value="LSTM">Deep LSTM</option>
          </select>
        </div>

        <div className="form-group">
          <label>Scenario:</label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          >
            <option value="">None (Baseline)</option>
            <option value="injury_qb">Major QB Injury</option>
            <option value="easy_schedule">Easy Schedule</option>
            <option value="weather_snow">Snow Game Chaos</option>
          </select>
        </div>

        <div className="form-group">
          <label>Iterations:</label>
          <input
            type="number"
            min="50"
            max="3000"
            value={iterations}
            onChange={(e) => setIterations(e.target.value)}
          />
        </div>

        <button className="btn-primary" disabled={loading}>
          {loading ? "Simulating..." : "Run What-If"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div className="fade-in" style={{ marginTop: "1rem" }}>
          <h4>
            Scenario: <strong>{niceScenario(result.scenarioApplied)}</strong>
          </h4>

          <p>
            Projected Record:{" "}
            <strong>{result.results.projectedRecord}</strong>
          </p>
          <p>
            Win Rate:{" "}
            <strong>{Number(result.results.winProbability).toFixed(1)}%</strong>
          </p>
          <p>
            Confidence:{" "}
            <strong>
              {Number(result.results.confidenceScore).toFixed(1)}%
            </strong>
          </p>

          <div
            style={{
              background: "#fff7e6",
              padding: "1rem",
              borderRadius: "8px",
              marginTop: "0.5rem",
            }}
          >
            <strong>AI Storyline:</strong>
            <p style={{ marginTop: "0.5rem" }}>{result.results.story}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================
// COMPONENT: App (Main Layout)
// =========================================
function App() {
  const currentYear = new Date().getFullYear();

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          marginBottom: "2rem",
          borderBottom: "2px solid #eee",
          paddingBottom: "1rem",
        }}
      >
        <h1 style={{ color: "#003594", margin: 0 }}>LoneStar Analytics 🏈</h1>
        <p style={{ color: "#666", marginTop: "0.5rem" }}>
          Dallas Cowboys Real-time Dashboard
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "2rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <RecordCard year={currentYear} />
          <PredictionPanel />
          <WhatIfSimulator />
        </div>

        <div>
          <GameTable year={currentYear} />
        </div>
      </div>
    </div>
  );
}

// =========================================
// RENDER
// =========================================
ReactDOM.render(<App />, document.getElementById("root"));

