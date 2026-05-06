import React from "react";
import { api } from "../api";
import { BASE_URL } from "../api";

function FantasyPage({ year = new Date().getFullYear() }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);
  const [format, setFormat] = React.useState("ppr");
  const [positionFilter, setPositionFilter] = React.useState("ALL");
  const [sortBy, setSortBy] = React.useState("dvo");
  const [search, setSearch] = React.useState("");
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  React.useEffect(() => {
    loadFantasyBoard();
  }, [year, format]);

  async function loadFantasyBoard() {
    try {
      setLoading(true);
      setError("");

      const result = api?.getFantasyBoard
        ? await api.getFantasyBoard(year, format)
        : await fetch(`${BASE_URL}/api/fantasy/board?year=${year}&format=${format}`)
            .then(r => r.json());

      setData(result || null);
      setSelectedPlayer(null);
    } catch (err) {
      setError(err.message || "Failed to load fantasy board.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function safeArray(v) { return Array.isArray(v) ? v : []; }
  function asNumber(v) { const n = Number(v); return isFinite(n) ? n : 0; }

  function getPlayers() {
    if (!data) return [];
    const list = data.players || data.rankings || data.board || [];
    return list.map((p, i) => ({
      id: p.id || i,
      name: p.name || "Unknown",
      position: p.position || "N/A",
      team: p.team || "—",
      dvo: asNumber(p.dvo || p.value),
      vbd: asNumber(p.vbd),
      projected: asNumber(p.projectedPoints),
      reliability: asNumber(p.reliability),
      risk: asNumber(p.riskFactor),
      grade: p.draftGrade || "N/A",
      tier: p.tier || "—",
      recommendation: p.recommendation || "No insight available."
    }));
  }

  function filteredPlayers() {
    let rows = getPlayers();

    if (positionFilter !== "ALL") {
      rows = rows.filter(p => p.position === positionFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return b[sortBy] - a[sortBy];
    });

    return rows;
  }

  const players = filteredPlayers();
  const topPlayer = players[0];

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Fantasy Intelligence</div>
          <h1 className="intel-title">Draft Board</h1>
          <p className="intel-subtitle">
            Evaluate fantasy value through DVO, VBD, projections, and risk-adjusted metrics.
          </p>
        </div>
        <div className="intel-hero__meta">
          <div className="intel-chip">{format.toUpperCase()}</div>
          <div className="intel-chip intel-chip--muted">{year}</div>
        </div>
      </section>

      {/* CONTROLS */}
      <section className="intel-panel">
        <div className="intel-control-grid">

          <select className="intel-select" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="half-ppr">Half PPR</option>
            <option value="ppr">PPR</option>
          </select>

          <select className="intel-select" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
          </select>

          <select className="intel-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="dvo">DVO</option>
            <option value="vbd">VBD</option>
            <option value="projected">Projection</option>
            <option value="reliability">Reliability</option>
            <option value="risk">Risk</option>
          </select>

          <input
            className="intel-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="intel-button" onClick={loadFantasyBoard}>
            Refresh
          </button>

        </div>
      </section>

      {/* STATS */}
      <section className="intel-stat-row">
        <article className="intel-stat">
          <div className="intel-stat__label">Players</div>
          <div className="intel-stat__value">{players.length}</div>
        </article>
        <article className="intel-stat">
          <div className="intel-stat__label">Top Player</div>
          <div className="intel-stat__value">{topPlayer?.name || "--"}</div>
        </article>
        <article className="intel-stat">
          <div className="intel-stat__label">Avg DVO</div>
          <div className="intel-stat__value">
            {(players.reduce((s, p) => s + p.dvo, 0) / (players.length || 1)).toFixed(1)}
          </div>
        </article>
      </section>

      {/* MAIN GRID */}
      <section className="intel-grid intel-grid--main">

        {/* TABLE */}
        <article className="intel-panel intel-panel--primary">
          <h2 className="intel-section-title">Draft Board</h2>

          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>DVO</th>
                  <th>VBD</th>
                  <th>Proj</th>
                  <th>Rel</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} onClick={() => setSelectedPlayer(p)}>
                    <td>{p.name}</td>
                    <td>{p.position}</td>
                    <td><span className="intel-badge intel-badge--accent">{p.dvo.toFixed(1)}</span></td>
                    <td>{p.vbd.toFixed(1)}</td>
                    <td>{p.projected.toFixed(1)}</td>
                    <td>{p.reliability.toFixed(1)}</td>
                    <td>
                      <span className={`intel-badge ${
                        p.risk > 0.5 ? "intel-badge--danger" : "intel-badge--success"
                      }`}>
                        {p.risk.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* PLAYER DETAIL */}
        {selectedPlayer && (
          <article className="intel-panel">
            <h2 className="intel-section-title">{selectedPlayer.name}</h2>

            <div className="intel-stack">
              <div className="intel-badge">{selectedPlayer.position} • {selectedPlayer.team}</div>

              <div className="intel-metric-grid">
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Projection</div>
                  <div className="intel-metric-card__value">{selectedPlayer.projected.toFixed(1)}</div>
                </div>
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">DVO</div>
                  <div className="intel-metric-card__value">{selectedPlayer.dvo.toFixed(1)}</div>
                </div>
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Risk</div>
                  <div className="intel-metric-card__value">{selectedPlayer.risk.toFixed(2)}</div>
                </div>
              </div>

              <div className="intel-story-panel">
                <h3>Recommendation</h3>
                <p>{selectedPlayer.recommendation}</p>
              </div>
            </div>
          </article>
        )}

      </section>

    </div>
  );
}

window.FantasyPage = FantasyPage;

export default FantasyPage;
