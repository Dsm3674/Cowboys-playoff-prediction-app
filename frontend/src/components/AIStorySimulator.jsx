function AIStorySimulator() {
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
    <div className="content-area">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>AI Story Simulator</h2>
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Run <strong>“What If?”</strong> scenarios and see how different events
          change the Cowboys’ season using Monte Carlo simulations.
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
              Scenario:{" "}
              <strong>{niceScenario(result.scenarioApplied)}</strong>
            </h4>

            <p>
              Projected Record:{" "}
              <strong>{result.results.projectedRecord}</strong>
            </p>
            <p>
              Win Rate:{" "}
              <strong>
                {Number(result.results.winProbability).toFixed(1)}%
              </strong>
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
    </div>
  );
}
