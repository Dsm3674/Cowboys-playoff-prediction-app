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

      let result = null;

      if (window.api && typeof window.api.getFantasyBoard === "function") {
        result = await window.api.getFantasyBoard(year, format);
      } else {
        const response = await fetch(
          `${window.BASE_URL || ""}/api/fantasy/board?year=${encodeURIComponent(year)}&format=${encodeURIComponent(format)}`
        );

        if (!response.ok) {
          throw new Error("Fantasy endpoint is not available yet.");
        }

        result = await response.json();
      }

      setData(result || null);
      setSelectedPlayer(null);
    } catch (err) {
      setError(err.message || "Failed to load fantasy board.");
      setData(null);
      setSelectedPlayer(null);
    } finally {
      setLoading(false);
    }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function asNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function asString(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    return String(value);
  }

  function getPlayers() {
    if (!data) return [];

    const candidateLists = [
      data.players,
      data.rankings,
      data.board,
      data.results,
      data.recommendations
    ];

    const list = candidateLists.find((item) => Array.isArray(item)) || [];

    return list.map((player, index) => normalizePlayer(player, index));
  }

  function normalizePlayer(player, index) {
    const metrics = safeObject(player.metrics);
    const projections = safeObject(player.projections);
    const stats = safeObject(player.stats);
    const profile = safeObject(player.profile);

    const floor =
      projections.floor ??
      stats.floor ??
      player.floor ??
      null;

    const ceiling =
      projections.ceiling ??
      stats.ceiling ??
      player.ceiling ??
      null;

    const projectedPoints =
      projections.projectedPoints ??
      stats.projectedPoints ??
      player.projectedPoints ??
      null;

    const dvo =
      metrics.dvo ??
      player.dvo ??
      player.value ??
      0;

    const vbd =
      metrics.vbd ??
      player.vbd ??
      0;

    const reliability =
      metrics.reliability ??
      player.reliability ??
      0;

    const riskFactor =
      metrics.riskFactor ??
      player.riskFactor ??
      0;

    const draftGrade =
      projections.draftGrade ??
      player.draftGrade ??
      "N/A";

    const recommendation =
      player.recommendation ??
      profile.recommendation ??
      "No recommendation available.";

    return {
      id: player.id || `${player.name || "player"}-${index}`,
      name: asString(player.name, "Unknown Player"),
      position: asString(player.position, "N/A"),
      team: asString(player.team, "DAL"),
      dvo: asNumber(dvo),
      vbd: asNumber(vbd),
      reliability: asNumber(reliability),
      riskFactor: asNumber(riskFactor),
      projectedPoints: projectedPoints === null ? null : asNumber(projectedPoints),
      floor: floor === null ? null : asNumber(floor),
      ceiling: ceiling === null ? null : asNumber(ceiling),
      draftGrade,
      recommendation: asString(recommendation, "No recommendation available."),
      scarcityImpact: asString(metrics.scarcityImpact, "—"),
      tier: asString(player.tier, profile.tier || "N/A"),
      upside: asString(profile.upside, ""),
      concerns: safeArray(player.concerns || profile.concerns),
      strengths: safeArray(profile.strengths),
      weaknesses: safeArray(profile.weaknesses),
      raw: player
    };
  }

  function filteredPlayers() {
    let rows = getPlayers();

    if (positionFilter !== "ALL") {
      rows = rows.filter((player) => player.position === positionFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((player) => {
        return (
          player.name.toLowerCase().includes(q) ||
          player.position.toLowerCase().includes(q) ||
          player.team.toLowerCase().includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "position") return a.position.localeCompare(b.position);
      return asNumber(b[sortBy]) - asNumber(a[sortBy]);
    });

    return rows;
  }

  function topSummary(players) {
    const rows = safeArray(players);
    if (!rows.length) {
      return {
        count: 0,
        avgDvo: 0,
        avgProjection: 0,
        bestPlayer: null
      };
    }

    const avgDvo =
      rows.reduce((sum, player) => sum + asNumber(player.dvo), 0) / rows.length;

    const projectionRows = rows.filter((player) => player.projectedPoints !== null);
    const avgProjection = projectionRows.length
      ? projectionRows.reduce((sum, player) => sum + asNumber(player.projectedPoints), 0) / projectionRows.length
      : 0;

    return {
      count: rows.length,
      avgDvo,
      avgProjection,
      bestPlayer: rows[0]
    };
  }

  function scoreColor(value) {
    const num = asNumber(value);
    if (num >= 20) return "#15803d";
    if (num >= 10) return "#0369a1";
    if (num >= 0) return "#7c3aed";
    if (num >= -5) return "#b45309";
    return "#b91c1c";
  }

  function riskColor(value) {
    const num = asNumber(value);
    if (num <= 0.2) return "#15803d";
    if (num <= 0.45) return "#b45309";
    return "#b91c1c";
  }

  function gradeBg(grade) {
    const g = asString(grade).toUpperCase();
    if (g.startsWith("A")) return "#dcfce7";
    if (g.startsWith("B")) return "#dbeafe";
    if (g.startsWith("C")) return "#fef3c7";
    return "#fee2e2";
  }

  const players = filteredPlayers();
  const summary = topSummary(players);

  return (
    <div className="content-area">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Fantasy Draft Board</h2>
        <p className="text-small text-muted">
          A lightweight fantasy view built to plug into your existing FantasyEngine service.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginTop: "1rem"
          }}
        >
          <div className="form-group">
            <label>Season</label>
            <input
              type="number"
              value={year}
              readOnly
            />
          </div>

          <div className="form-group">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="half-ppr">Half PPR</option>
              <option value="ppr">PPR</option>
            </select>
          </div>

          <div className="form-group">
            <label>Position</label>
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="DEF">DEF</option>
              <option value="K">K</option>
            </select>
          </div>

          <div className="form-group">
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="dvo">DVO</option>
              <option value="vbd">VBD</option>
              <option value="projectedPoints">Projected Points</option>
              <option value="reliability">Reliability</option>
              <option value="riskFactor">Risk</option>
              <option value="name">Name</option>
              <option value="position">Position</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1rem",
            flexWrap: "wrap"
          }}
        >
          <input
            type="text"
            placeholder="Search player or position"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 260px",
              minWidth: "220px"
            }}
          />
          <button className="btn-primary" onClick={loadFantasyBoard}>
            Refresh Board
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: "1rem" }} className="text-small text-muted">
            Loading fantasy board...
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.9rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#991b1b"
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginTop: "1.25rem"
              }}
            >
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "10px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe"
                }}
              >
                <div className="text-small text-muted">Visible Players</div>
                <div style={{ fontSize: "1.7rem", fontWeight: 800 }}>{summary.count}</div>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "10px",
                  background: "#f5f3ff",
                  border: "1px solid #ddd6fe"
                }}
              >
                <div className="text-small text-muted">Average DVO</div>
                <div style={{ fontSize: "1.7rem", fontWeight: 800 }}>
                  {summary.avgDvo.toFixed(1)}
                </div>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "10px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0"
                }}
              >
                <div className="text-small text-muted">Avg Projection</div>
                <div style={{ fontSize: "1.7rem", fontWeight: 800 }}>
                  {summary.avgProjection.toFixed(1)}
                </div>
              </div>

              <div
                style={{
                  padding: "1rem",
                  borderRadius: "10px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa"
                }}
              >
                <div className="text-small text-muted">Top Recommendation</div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>
                  {summary.bestPlayer ? summary.bestPlayer.name : "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "1.5rem",
                display: "grid",
                gridTemplateColumns: selectedPlayer ? "minmax(0, 1.5fr) minmax(320px, 1fr)" : "1fr",
                gap: "1rem",
                alignItems: "start"
              }}
            >
              <div className="card" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>Draft Board</h3>

                {players.length === 0 ? (
                  <p className="text-small text-muted">
                    No fantasy players available yet. This usually means the backend route is not wired yet.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Player</th>
                          <th style={thStyle}>Pos</th>
                          <th style={thStyle}>DVO</th>
                          <th style={thStyle}>VBD</th>
                          <th style={thStyle}>Proj</th>
                          <th style={thStyle}>Reliability</th>
                          <th style={thStyle}>Risk</th>
                          <th style={thStyle}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player) => {
                          const selected = selectedPlayer && selectedPlayer.id === player.id;

                          return (
                            <tr
                              key={player.id}
                              onClick={() => setSelectedPlayer(player)}
                              style={{
                                cursor: "pointer",
                                background: selected ? "#f8fafc" : "transparent"
                              }}
                            >
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 700 }}>{player.name}</div>
                                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                  {player.team}
                                </div>
                              </td>
                              <td style={tdStyle}>{player.position}</td>
                              <td style={{ ...tdStyle, color: scoreColor(player.dvo), fontWeight: 800 }}>
                                {player.dvo.toFixed(1)}
                              </td>
                              <td style={{ ...tdStyle, color: scoreColor(player.vbd), fontWeight: 800 }}>
                                {player.vbd.toFixed(1)}
                              </td>
                              <td style={tdStyle}>
                                {player.projectedPoints === null ? "—" : player.projectedPoints.toFixed(1)}
                              </td>
                              <td style={tdStyle}>{player.reliability.toFixed(1)}</td>
                              <td style={{ ...tdStyle, color: riskColor(player.riskFactor), fontWeight: 800 }}>
                                {player.riskFactor.toFixed(2)}
                              </td>
                              <td style={tdStyle}>
                                <span
                                  style={{
                                    background: gradeBg(player.draftGrade),
                                    padding: "4px 8px",
                                    borderRadius: "999px",
                                    fontWeight: 700,
                                    fontSize: "0.8rem"
                                  }}
                                >
                                  {player.draftGrade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedPlayer ? (
                <div className="card" style={{ margin: 0 }}>
                  <h3 style={{ marginTop: 0 }}>Player Detail</h3>

                  <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                    {selectedPlayer.name}
                  </div>
                  <div className="text-small text-muted" style={{ marginTop: "0.25rem" }}>
                    {selectedPlayer.position} • {selectedPlayer.team} • Tier: {selectedPlayer.tier}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                      marginTop: "1rem"
                    }}
                  >
                    <MetricBox label="Projected" value={selectedPlayer.projectedPoints === null ? "—" : selectedPlayer.projectedPoints.toFixed(1)} />
                    <MetricBox label="Floor" value={selectedPlayer.floor === null ? "—" : selectedPlayer.floor.toFixed(1)} />
                    <MetricBox label="Ceiling" value={selectedPlayer.ceiling === null ? "—" : selectedPlayer.ceiling.toFixed(1)} />
                    <MetricBox label="Scarcity" value={selectedPlayer.scarcityImpact} />
                  </div>

                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.9rem 1rem",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "8px"
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Recommendation</div>
                    <div style={{ color: "#334155", fontSize: "0.92rem", lineHeight: 1.6 }}>
                      {selectedPlayer.recommendation}
                    </div>
                  </div>

                  {selectedPlayer.strengths.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <h4 style={{ marginBottom: "0.5rem" }}>Strengths</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#334155" }}>
                        {selectedPlayer.strengths.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedPlayer.weaknesses.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <h4 style={{ marginBottom: "0.5rem" }}>Weaknesses</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#334155" }}>
                        {selectedPlayer.weaknesses.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedPlayer.concerns.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <h4 style={{ marginBottom: "0.5rem" }}>Concerns</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#334155" }}>
                        {selectedPlayer.concerns.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div
      style={{
        padding: "0.85rem",
        borderRadius: "8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0"
      }}
    >
      <div className="text-small text-muted">{label}</div>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", marginTop: "0.2rem" }}>
        {value}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "12px 10px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontWeight: 700,
  color: "#475569",
  fontSize: "0.9rem"
};

const tdStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.9rem",
  verticalAlign: "top"
};

window.FantasyPage = FantasyPage;
