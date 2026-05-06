import React from "react";
import { api } from "../api";

function LiveWinProbTool() {
  const [inputs, setInputs] = React.useState({
    scoreDiff: 0,
    secondsRemaining: 900,
    yardLine: 50,
    offenseTimeouts: 3,
    defenseTimeouts: 3,
    down: 1,
    yardsToGo: 10,
    possession: "team"
  });

  const [prob, setProb] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleChange = (field, value) => {
    setInputs((prev) => ({
      ...prev,
      [field]: field === "possession" ? value : Number(value)
    }));
  };

  const calculate = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.getWinProb(inputs);
      setProb(res?.winProbability ?? null);
    } catch (err) {
      setError(err?.message || "Failed to calculate win probability.");
      setProb(null);
    } finally {
      setLoading(false);
    }
  };

  const gameStateLabel =
    inputs.scoreDiff > 0
      ? "Dallas leading"
      : inputs.scoreDiff < 0
      ? "Dallas trailing"
      : "Game tied";

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Live Decision Tool</div>
          <h1 className="intel-title">Win Probability Calculator</h1>
          <p className="intel-subtitle">
            Input the current game state to estimate Dallas’ live win probability
            from score, field position, time pressure, and possession context.
          </p>
          <p className="intel-note">
            This page is meant to feel like a live sideline intelligence tool, not
            just a form.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{gameStateLabel}</div>
          <div className="intel-chip intel-chip--muted">
            {Math.floor(inputs.secondsRemaining / 60)}m {inputs.secondsRemaining % 60}s left
          </div>
        </div>
      </section>

      {error ? (
        <div className="intel-banner intel-banner--warning">{error}</div>
      ) : null}

      <section className="intel-stat-row">
        <article className="intel-stat">
          <div className="intel-stat__label">Score Differential</div>
          <div className="intel-stat__value">
            {inputs.scoreDiff > 0 ? `+${inputs.scoreDiff}` : inputs.scoreDiff}
          </div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Field Position</div>
          <div className="intel-stat__value">{inputs.yardLine}</div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Down & Distance</div>
          <div className="intel-stat__value">
            {inputs.down} & {inputs.yardsToGo}
          </div>
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
              <div className="intel-section-kicker">Game Inputs</div>
              <h2 className="intel-section-title">State Builder</h2>
            </div>
            <div className="intel-section-meta">Score · clock · field · down</div>
          </div>

          <div className="intel-form">
            <div className="intel-control-grid">
              <div className="intel-form-group">
                <label className="intel-label">Score Diff</label>
                <input
                  className="intel-input"
                  type="number"
                  value={inputs.scoreDiff}
                  onChange={(e) => handleChange("scoreDiff", e.target.value)}
                />
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Seconds Left</label>
                <input
                  className="intel-input"
                  type="number"
                  value={inputs.secondsRemaining}
                  onChange={(e) => handleChange("secondsRemaining", e.target.value)}
                />
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Ball On</label>
                <input
                  className="intel-input"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.yardLine}
                  onChange={(e) => handleChange("yardLine", e.target.value)}
                />
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Down</label>
                <select
                  className="intel-select"
                  value={inputs.down}
                  onChange={(e) => handleChange("down", e.target.value)}
                >
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                  <option value="3">3rd</option>
                  <option value="4">4th</option>
                </select>
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Yards To Go</label>
                <input
                  className="intel-input"
                  type="number"
                  min="1"
                  value={inputs.yardsToGo}
                  onChange={(e) => handleChange("yardsToGo", e.target.value)}
                />
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Possession</label>
                <select
                  className="intel-select"
                  value={inputs.possession}
                  onChange={(e) => handleChange("possession", e.target.value)}
                >
                  <option value="team">Dallas</option>
                  <option value="opponent">Opponent</option>
                </select>
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Dallas Timeouts</label>
                <input
                  className="intel-input"
                  type="number"
                  min="0"
                  max="3"
                  value={inputs.offenseTimeouts}
                  onChange={(e) => handleChange("offenseTimeouts", e.target.value)}
                />
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Opponent Timeouts</label>
                <input
                  className="intel-input"
                  type="number"
                  min="0"
                  max="3"
                  value={inputs.defenseTimeouts}
                  onChange={(e) => handleChange("defenseTimeouts", e.target.value)}
                />
              </div>
            </div>

            <div className="intel-action-row">
              <button
                className="intel-button intel-button--primary"
                onClick={calculate}
                disabled={loading}
                type="button"
              >
                {loading ? "Calculating..." : "Calculate Odds"}
              </button>
            </div>
          </div>
        </article>

        <article className="intel-panel intel-panel--results">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Live Output</div>
              <h2 className="intel-section-title">Probability Readout</h2>
            </div>
            <div className="intel-section-meta">
              {prob !== null ? "Live result ready" : "Awaiting calculation"}
            </div>
          </div>

          {prob === null ? (
            <div className="intel-empty">
              Enter the current game state and run the model to generate a live
              win probability.
            </div>
          ) : (
            <div className="intel-stack">
              <section className="intel-story-panel intel-story-panel--center">
                <div className="intel-section-kicker">Win Probability</div>
                <div className="intel-big-number">{(prob * 100).toFixed(1)}%</div>
                <p className="intel-story-copy">
                  Based on the current score margin, field position, clock
                  pressure, and possession state.
                </p>
              </section>

              <section className="intel-metric-grid">
                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Score State</div>
                  <div className="intel-metric-card__value">
                    {inputs.scoreDiff > 0 ? "Leading" : inputs.scoreDiff < 0 ? "Trailing" : "Tied"}
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Possession</div>
                  <div className="intel-metric-card__value">
                    {inputs.possession === "team" ? "Dallas" : "Opponent"}
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Clock</div>
                  <div className="intel-metric-card__value">
                    {Math.floor(inputs.secondsRemaining / 60)}:{String(
                      inputs.secondsRemaining % 60
                    ).padStart(2, "0")}
                  </div>
                </article>

                <article className="intel-metric-card">
                  <div className="intel-metric-card__label">Down & Distance</div>
                  <div className="intel-metric-card__value">
                    {inputs.down} & {inputs.yardsToGo}
                  </div>
                </article>
              </section>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

window.LiveWinProbTool = LiveWinProbTool;

export default LiveWinProbTool;
