import React from "react";
import { api } from "../api";

function RivalTeamImpactPage({ year = 2025, selectedTeam = "DAL" }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [chaos, setChaos] = React.useState(0);
  const [iterations, setIterations] = React.useState(1000);
  const [selectedRival, setSelectedRival] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("impactScore");

  React.useEffect(() => {
    loadRivalImpactData();
  }, [year, selectedTeam, chaos, iterations]);

  async function loadRivalImpactData() {
    try {
      setLoading(true);
      setError("");
      const result = await api.getRivalImpact(selectedTeam, year, chaos, iterations);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load rival impact analysis.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const impacts = Array.isArray(data?.rivalImpacts) ? data.rivalImpacts : [];
  const sortedImpacts = [...impacts].sort((a, b) => {
    if (sortBy === "impactScore") return (b.impactScore || 0) - (a.impactScore || 0);
    if (sortBy === "tsi") return (b.tsi || 0) - (a.tsi || 0);
    return (b.winProbability || 0) - (a.winProbability || 0);
  });

  const selectedTeamData = selectedRival
    ? impacts.find((t) => t.team === selectedRival)
    : null;

  const subject = data?.team || {};

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Rival Intelligence</div>
          <h1 className="intel-title">Rival Impact Engine</h1>
          <p className="intel-subtitle">
            Analyze how rival outcomes influence {selectedTeam}'s playoff trajectory.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{selectedTeam}</div>
          <div className="intel-chip intel-chip--muted">Season {year}</div>
        </div>
      </section>

      {error && (
        <div className="intel-banner intel-banner--warning">{error}</div>
      )}

      {/* CONTROLS */}
      <section className="intel-panel">
        <div className="intel-control-grid">

          <div className="intel-form-group">
            <label className="intel-label">Chaos ({chaos.toFixed(2)})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={chaos}
              onChange={(e) => setChaos(Number(e.target.value))}
              className="intel-slider"
            />
          </div>

          <div className="intel-form-group">
            <label className="intel-label">Iterations ({iterations})</label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="intel-slider"
            />
          </div>

          <button
            className="intel-button intel-button--primary"
            onClick={loadRivalImpactData}
            disabled={loading}
          >
            {loading ? "Running..." : "Apply"}
          </button>

        </div>
      </section>

      {/* STATS */}
      <section className="intel-stat-row">

        <article className="intel-stat">
          <div className="intel-stat__label">{selectedTeam} TSI</div>
          <div className="intel-stat__value">
            {formatValue(subject.tsi, 1)}
          </div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Playoff Odds</div>
          <div className="intel-stat__value">
            {formatValue(subject.playoffProbability, 1)}%
          </div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Rivals</div>
          <div className="intel-stat__value">{impacts.length}</div>
        </article>

        <article className="intel-stat intel-stat--accent">
          <div className="intel-stat__label">Top Threat</div>
          <div className="intel-stat__value">
            {sortedImpacts[0]?.team || "--"}
          </div>
        </article>

      </section>

      {/* MAIN GRID */}
      <section className="intel-grid intel-grid--main rival-rankings-grid">

        {/* TABLE */}
        <article className="intel-panel intel-panel--primary rival-rankings-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Rival Rankings</h2>

            <select
              className="intel-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="impactScore">Impact</option>
              <option value="tsi">TSI</option>
              <option value="winProbability">Win %</option>
            </select>
          </div>

          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>TSI</th>
                  <th>Impact</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {sortedImpacts.map((team) => (
                  <tr
                    key={team.team}
                    onClick={() => setSelectedRival(team.team)}
                    className={selectedRival === team.team ? "intel-row--active" : ""}
                  >
                    <td>{team.team}</td>
                    <td>{formatValue(team.tsi)}</td>
                    <td>
                      <span className="intel-badge intel-badge--danger">
                        {formatValue(team.impactScore)}
                      </span>
                    </td>
                    <td>{formatValue(team.winProbability)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* DETAIL PANEL */}
        <article className="intel-panel">
          <h2 className="intel-section-title">Rival Breakdown</h2>

          {!selectedTeamData ? (
            <div className="intel-empty">
              Select a rival to inspect impact details.
            </div>
          ) : (
            <div className="intel-stack">

              <div className="intel-badge">
                {selectedTeamData.team}
              </div>

              <div className="intel-metric-grid">
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Impact</div>
                  <div className="intel-metric-card__value">
                    {formatValue(selectedTeamData.impactScore)}
                  </div>
                </div>

                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Win %</div>
                  <div className="intel-metric-card__value">
                    {formatValue(selectedTeamData.winProbability)}%
                  </div>
                </div>

                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Playoff Swing</div>
                  <div className="intel-metric-card__value">
                    {formatValue(selectedTeamData.playoffImpactPercentage)}%
                  </div>
                </div>
              </div>

              {data?.summary?.narrative && (
                <div className="intel-story-panel">
                  <p>{data.summary.narrative}</p>
                </div>
              )}

            </div>
          )}
        </article>

      </section>

    </div>
  );
}

function formatValue(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

window.RivalTeamImpactPage = RivalTeamImpactPage;

export default RivalTeamImpactPage;
