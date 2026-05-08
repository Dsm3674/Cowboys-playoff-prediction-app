import React from "react";
import { api } from "../api";

function AIStorySimulator() {
  const [modelType, setModelType] = React.useState("RandomForest");
  const [scenario, setScenario] = React.useState("");
  const [iterations, setIterations] = React.useState(500);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const modelOptions = [
    {
      value: "RandomForest",
      label: "Random Forest",
      note: "Balanced baseline model for structured season outcomes.",
    },
    {
      value: "Elo",
      label: "Elo Rating",
      note: "Momentum-driven projection using rating movement.",
    },
    {
      value: "LSTM",
      label: "Deep LSTM",
      note: "Sequence-based model for trend-sensitive projections.",
    },
  ];

  const scenarioOptions = [
    {
      value: "",
      label: "Baseline Season",
      note: "No special shock applied.",
    },
    {
      value: "injury_qb",
      label: "Major QB Injury",
      note: "Stress test the offense under a quarterback shock.",
    },
    {
      value: "easy_schedule",
      label: "Easy Schedule",
      note: "Model a softer closing stretch.",
    },
    {
      value: "weather_snow",
      label: "Snow Game Chaos",
      note: "Inject weather variance and game-state instability.",
    },
  ];

  const niceScenario = (code) => {
    if (!code) return "Baseline Season";
    if (code === "injury_qb") return "QB Injury Shock";
    if (code === "easy_schedule") return "Soft Schedule Advantage";
    if (code === "weather_snow") return "Snow Game Chaos";
    return code;
  };

  const runSim = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        modelType,
        scenario: scenario || null,
        iterations: Number(iterations) || 500,
      };

      const data = await api.runWhatIfSimulation(payload);

      if (!data?.success) {
        throw new Error("Simulation failed on server");
      }

      setResult(data);
    } catch (err) {
      setError(err?.message || "Unable to run simulation.");
    } finally {
      setLoading(false);
    }
  };

  const activeModel =
    modelOptions.find((option) => option.value === modelType) || modelOptions[0];
  const activeScenario =
    scenarioOptions.find((option) => option.value === scenario) || scenarioOptions[0];

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Simulation Lab</div>
          <h1 className="intel-title">AI Story Simulator</h1>
          <p className="intel-subtitle">
            Run controlled what-if scenarios and measure how model choice,
            season shocks, and simulation depth change the Cowboys’ projected arc.
          </p>
          <p className="intel-note">
            This is a narrative simulation board, not just a form. Use it to compare
            baseline expectations against disruption scenarios and alternate model behavior.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Monte Carlo Engine</div>
          <div className="intel-chip intel-chip--muted">{activeModel.label}</div>
          <div className="intel-chip intel-chip--muted">{niceScenario(scenario)}</div>
        </div>
      </section>

      {error ? (
        <div className="intel-banner intel-banner--warning">{error}</div>
      ) : null}

      <section className="intel-stat-row">
        <article className="intel-stat intel-stat--accent">
          <div className="intel-stat__label">Active Model</div>
          <div className="intel-stat__value">{activeModel.label}</div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Scenario</div>
          <div className="intel-stat__value">{niceScenario(scenario)}</div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Iterations</div>
          <div className="intel-stat__value">{Number(iterations) || 500}</div>
        </article>

        <article className="intel-stat intel-stat--success">
          <div className="intel-stat__label">Engine State</div>
          <div className="intel-stat__value">{loading ? "Running" : "Ready"}</div>
        </article>
      </section>

      <section className="intel-grid intel-grid--tool">
        <article className="intel-panel intel-panel--controls">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Simulation Controls</div>
              <h2 className="intel-section-title">Scenario Builder</h2>
            </div>
            <div className="intel-section-meta">Model · shock · depth</div>
          </div>

          <form onSubmit={runSim} className="intel-form">
            <div className="intel-form-group">
              <label className="intel-label" htmlFor="ai-story-model">
                Model Type
              </label>
              <select
                id="ai-story-model"
                className="intel-select"
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="intel-field-note">{activeModel.note}</p>
            </div>

            <div className="intel-form-group">
              <label className="intel-label" htmlFor="ai-story-scenario">
                Scenario
              </label>
              <select
                id="ai-story-scenario"
                className="intel-select"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                {scenarioOptions.map((option) => (
                  <option key={option.value || "baseline"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="intel-field-note">{activeScenario.note}</p>
            </div>

            <div className="intel-form-group">
              <label className="intel-label" htmlFor="ai-story-iterations">
                Iterations
              </label>
              <input
                id="ai-story-iterations"
                className="intel-input"
                type="number"
                min="50"
                max="3000"
                step="50"
                value={iterations}
                onChange={(e) => setIterations(e.target.value)}
              />
              <p className="intel-field-note">
                Higher iteration counts improve stability but take longer to resolve.
              </p>
            </div>

            <div className="intel-action-row">
              <button
                type="submit"
                className="intel-button intel-button--primary"
                disabled={loading}
              >
                {loading ? "Running Simulation..." : "Run What-If"}
              </button>
            </div>
          </form>
        </article>

        <article className="intel-panel intel-panel--results">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Simulation Output</div>
              <h2 className="intel-section-title">Story Board</h2>
            </div>
            <div className="intel-section-meta">
              {result ? niceScenario(result.scenarioApplied) : "Awaiting run"}
            </div>
          </div>

          {!result ? (
            <div className="intel-empty">
              Run a simulation to generate projected record, win probability,
              confidence score, and the narrative storyline.
            </div>
          ) : (
            <div className="intel-stack">
              <section className="intel-metric-grid">
                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Projected Record</div>
                  <div className="intel-metric-card__value">
                    {result.results?.projectedRecord || "--"}
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Win Rate</div>
                  <div className="intel-metric-card__value">
                    {Number(result.results?.winProbability || 0).toFixed(1)}%
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Confidence</div>
                  <div className="intel-metric-card__value">
                    {Number(result.results?.confidenceScore || 0).toFixed(1)}%
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Scenario</div>
                  <div className="intel-metric-card__value">
                    {niceScenario(result.scenarioApplied)}
                  </div>
                </article>
              </section>

              <section className="intel-story-panel">
                <div className="intel-section-kicker">Narrative Output</div>
                <h3 className="intel-story-title">AI Storyline</h3>
                <p className="intel-story-copy">
                  {result.results?.story || "No story returned by the engine."}
                </p>
              </section>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

window.AIStorySimulator = AIStorySimulator;

export default AIStorySimulator;
