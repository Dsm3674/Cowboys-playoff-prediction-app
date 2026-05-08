import React from "react";
import { api } from "../api";

function Maps() {
  const canvasRef = React.useRef(null);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [hoveredPlayer, setHoveredPlayer] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [showLabels, setShowLabels] = React.useState(true);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const PADDING = 60;

  React.useEffect(() => {
    loadPlayerMaps();
  }, []);

  const loadPlayerMaps = async () => {
    try {
      setLoading(true);
      const result = await api.getPlayerMaps();
      setData(result);
    } catch (error) {
      console.error("Error loading player maps:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (data && canvasRef.current) {
      drawMap();
    }
  }, [data, hoveredPlayer, selectedCategory, showLabels]);

  // keep ALL your existing draw functions unchanged ↓↓↓
  // drawMap, drawQuadrants, drawGrid, drawAxes, etc...

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div>
            <div className="intel-kicker">Player Intelligence</div>
            <h1 className="intel-title">Loading performance map...</h1>
            <p className="intel-subtitle">
              Building consistency vs explosiveness visualization.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <h1 className="intel-title">No data available</h1>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Player Intelligence</div>
          <h1 className="intel-title">Consistency vs Explosiveness</h1>
          <p className="intel-subtitle">
            Visualize player performance across reliability and big-play potential.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{data.players.length} Players</div>
          <div className="intel-chip intel-chip--muted">
            Live classification engine
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="intel-grid intel-grid--main">

        {/* CANVAS */}
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Performance Map</h2>
          </div>

          <div className="intel-toolbar">
            <label className="intel-checkbox">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              Show Labels
            </label>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={handleCanvasHover}
            onMouseLeave={() => setHoveredPlayer(null)}
            className="intel-canvas"
          />
        </article>

        {/* SIDEBAR */}
        <div className="intel-stack">

          {/* FILTER */}
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Filter</h3>
            </div>

            <div className="intel-stack">
              <button
                className={`intel-button ${selectedCategory === null ? "intel-button--primary" : ""}`}
                onClick={() => setSelectedCategory(null)}
              >
                All Players
              </button>

              {["elite", "volatile", "reliable", "inconsistent"].map((cat) => (
                <button
                  key={cat}
                  className="intel-button"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </article>

          {/* QUICK STATS */}
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Overview</h3>
            </div>

            <div className="intel-metric-grid">
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Players</div>
                <div className="intel-metric-card__value">
                  {data.players.length}
                </div>
              </div>
            </div>
          </article>

          {/* ELITE */}
          {data.quadrants.elite.players.length > 0 && (
            <article className="intel-panel">
              <div className="intel-section-kicker">Elite</div>
              <h3 className="intel-section-title">Quietly Elite</h3>

              <div className="intel-stack">
                {data.quadrants.elite.players.map((p) => (
                  <div key={p.id} className="intel-row">
                    <div className="intel-row__title">{p.name}</div>
                    <div className="intel-row__meta">{p.position}</div>
                  </div>
                ))}
              </div>
            </article>
          )}

        </div>
      </section>

      {/* INSIGHTS */}
      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Insights</h2>
        </div>

        <div className="intel-grid intel-grid--support">
          {data.insights.map((insight, idx) => (
            <article key={idx} className="intel-panel intel-panel--insight">
              <div className="intel-section-kicker">
                {getInsightIcon(insight.type)}
              </div>
              <h3 className="intel-section-title">{insight.title}</h3>
              <p className="intel-note">{insight.message}</p>
            </article>
          ))}
        </div>
      </section>

      {/* TABLE */}
      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">All Players</h2>
        </div>

        <div className="intel-table-wrap">
          <table className="intel-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Consistency</th>
                <th>Explosiveness</th>
                <th>Category</th>
                <th>Volatility</th>
              </tr>
            </thead>

            <tbody>
              {data.players.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.position}</td>
                  <td>{p.consistency}</td>
                  <td>{p.explosiveness}</td>
                  <td>
                    <span className="intel-badge">
                      {p.category}
                    </span>
                  </td>
                  <td>{p.volatility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

window.Maps = Maps;

export default Maps;
