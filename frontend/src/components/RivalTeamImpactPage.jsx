/**
 * RivalTeamImpactPage.jsx
 * Main page component for displaying rival team impact analysis
 * with toggles for chaos and iterations
 */

function RivalTeamImpactPage({ year = 2025 }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [chaos, setChaos] = React.useState(0);
  const [iterations, setIterations] = React.useState(1000);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("impactScore");

  // Load initial data
  React.useEffect(() => {
    loadRivalImpactData();
  }, [year]);

  const loadRivalImpactData = async () => {
    try {
      setLoading(true);
      const result = await window.api.getRivalImpact(year, chaos, iterations);
      setData(result);
    } catch (error) {
      console.error("Error loading rival impact:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    loadRivalImpactData();
  };

  const handleChaosChange = (value) => {
    setChaos(value);
  };

  const handleIterationsChange = (value) => {
    setIterations(Math.max(100, Math.min(5000, value)));
  };

  if (!data && !loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#666" }}>Loading impact analysis...</p>
          <button
            onClick={loadRivalImpactData}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              marginTop: "1rem",
            }}
          >
            Load Analysis
          </button>
        </div>
      </div>
    );
  }

  const impacts = data?.rivalImpacts || [];
  const cowboys = data?.cowboys || {};
  const rankedGames = data?.rankedGames || [];

  const sortedImpacts = [...impacts].sort((a, b) => {
    if (sortBy === "impactScore") return b.impactScore - a.impactScore;
    if (sortBy === "winProbability")
      return b.winProbability - a.winProbability;
    if (sortBy === "urgency") {
      const urgencyMap = { critical: 3, high: 2, medium: 1 };
      return (
        (urgencyMap[b.urgency] || 0) - (urgencyMap[a.urgency] || 0)
      );
    }
    return 0;
  });

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e40af 0%, #0284c7 100%)",
          color: "#fff",
          padding: "2rem",
          borderRadius: "8px",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem", marginBottom: "0.5rem" }}>
          Rival Team Impact Analyzer
        </h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Visualize how different teams' outcomes impact the Cowboys' playoff
          chances
        </p>
      </div>

      {/* Control Panel */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: "1.1rem", color: "#1f2937" }}>
          Analysis Parameters
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Cowboys Stats */}
          <div
            style={{
              background: "#f0f9ff",
              padding: "1rem",
              borderRadius: "6px",
              borderLeft: "4px solid #0284c7",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
              Cowboys TSI
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#0284c7" }}>
              {cowboys.tsi || "--"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
              Playoff Probability: {cowboys.baselinePlayoffProbability}%
            </div>
          </div>

          {/* Chaos Control */}
          <div
            style={{
              background: "#fef3c7",
              padding: "1rem",
              borderRadius: "6px",
              borderLeft: "4px solid #d97706",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
              <strong>Chaos Factor: {(chaos * 100).toFixed(0)}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={chaos}
              onChange={(e) => handleChaosChange(parseFloat(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#d97706",
                outline: "none",
                cursor: "pointer",
              }}
            />
            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.5rem" }}>
              0 = deterministic, 1 = chaotic scenarios
            </div>
          </div>

          {/* Iterations Control */}
          <div
            style={{
              background: "#dcfce7",
              padding: "1rem",
              borderRadius: "6px",
              borderLeft: "4px solid #22c55e",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
              <strong>Iterations: {iterations.toLocaleString()}</strong>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={iterations}
              onChange={(e) => handleIterationsChange(parseInt(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#22c55e",
                outline: "none",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "0.75rem",
                color: "#666",
                marginTop: "0.5rem",
              }}
            >
              More iterations = more accurate but slower
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={handleApplyChanges}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: loading ? "#d1d5db" : "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {loading ? "Analyzing..." : "Analyze Impact"}
          </button>
          <button
            onClick={() => {
              setChaos(0);
              setIterations(1000);
            }}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Ranked Games Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Left: Quick Summary */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "8px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: "1rem", color: "#1f2937" }}>
            Summary
          </h3>
          <div
            style={{
              fontSize: "0.9rem",
              lineHeight: "1.6",
              color: "#666",
              marginBottom: "1rem",
            }}
          >
            {data?.summary}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <h4 style={{ marginTop: 0, fontSize: "0.9rem", color: "#1f2937" }}>
              Impact Distribution
            </h4>
            {impacts.slice(0, 5).map((impact) => (
              <div
                key={impact.team}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  background:
                    selectedTeam === impact.team ? "#e0f2fe" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setSelectedTeam(
                    selectedTeam === impact.team ? null : impact.team
                  )
                }
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: getUrgencyColor(impact.urgency),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    marginRight: "0.75rem",
                    flexShrink: 0,
                  }}
                >
                  {impact.impactScore}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f2937" }}
                  >
                    {impact.teamName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#999",
                    }}
                  >
                    {impact.tier.replace("_", " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top Ranked Games */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "1.5rem",
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
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#1f2937" }}>
              Top Games to Root For
            </h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "0.4rem 0.6rem",
                border: "1px solid #e5e7eb",
                borderRadius: "4px",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <option value="impactScore">By Impact</option>
              <option value="winProbability">By Win %</option>
              <option value="urgency">By Urgency</option>
            </select>
          </div>

          {rankedGames.length === 0 ? (
            <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
              No games found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {rankedGames.slice(0, 8).map((game, idx) => (
                <div
                  key={`${game.team}-${idx}`}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${getUrgencyColor(game.urgency)}`,
                    borderRadius: "6px",
                    padding: "0.75rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f9ff";
                    e.currentTarget.style.borderColor = "#0284c7";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f9fafb";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        background: getUrgencyColor(game.urgency),
                        color: "#fff",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      #{game.rank}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            background: getTierColor(game.tier),
                            color: "#fff",
                            padding: "0.2rem 0.6rem",
                            borderRadius: "3px",
                            textTransform: "uppercase",
                          }}
                        >
                          {game.tier === "direct_rival"
                            ? "Division"
                            : game.tier === "threat"
                            ? "Threat"
                            : "Contender"}
                        </span>
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: "#1f2937",
                          }}
                        >
                          {game.teamName}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "0.5rem",
                          fontSize: "0.8rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#666" }}>Impact:</strong>{" "}
                          <span
                            style={{
                              fontWeight: 700,
                              color: getUrgencyColor(game.urgency),
                            }}
                          >
                            {game.impactScore}
                          </span>
                        </div>
                        <div>
                          <strong style={{ color: "#666" }}>Root for:</strong>{" "}
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                game.recommendedOutcome === "Loss"
                                  ? "#dc2626"
                                  : "#059669",
                            }}
                          >
                            {game.recommendedOutcome}
                          </span>
                        </div>
                        <div>
                          <strong style={{ color: "#666" }}>Their %:</strong>{" "}
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#0891b2",
                            }}
                          >
                            {game.winProbability}%
                          </span>
                        </div>
                      </div>

                      {game.simulation && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#666",
                            background: "#f0f0f0",
                            padding: "0.4rem",
                            borderRadius: "3px",
                          }}
                        >
                          If they win: Cowboys {game.simulation.ifRivalWins.average.toFixed(0)}% | If they lose: Cowboys {game.simulation.ifRivalLoses.average.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Impact Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          padding: "1.5rem",
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
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#1f2937" }}>
            All Rival Teams Analysis
          </h3>
          <span
            style={{
              fontSize: "0.85rem",
              color: "#666",
            }}
          >
            {impacts.length} teams tracked
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Team
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Tier
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  TSI
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Impact Score
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Urgency
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Win %
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.75rem",
                    fontWeight: 600,
                    color: "#666",
                  }}
                >
                  Cowboys Best Case
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedImpacts.map((impact, idx) => (
                <tr
                  key={impact.team}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f9ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      idx % 2 === 0 ? "#fff" : "#f9fafb";
                  }}
                  onClick={() =>
                    setSelectedTeam(
                      selectedTeam === impact.team ? null : impact.team
                    )
                  }
                >
                  <td style={{ padding: "0.75rem", fontWeight: 600, color: "#1f2937" }}>
                    {impact.teamName}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        background: getTierColor(impact.tier),
                        color: "#fff",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "3px",
                        textTransform: "uppercase",
                      }}
                    >
                      {impact.tier === "direct_rival"
                        ? "Division"
                        : impact.tier === "threat"
                        ? "Threat"
                        : "Contender"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#0891b2",
                    }}
                  >
                    {impact.tsi}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 700,
                      color: getUrgencyColor(impact.urgency),
                    }}
                  >
                    {impact.impactScore}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        background: getUrgencyColor(impact.urgency),
                        color: "#fff",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "3px",
                        textTransform: "capitalize",
                      }}
                    >
                      {impact.urgency}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#1f2937",
                    }}
                  >
                    {impact.winProbability}%
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#059669",
                    }}
                  >
                    {impact.bestCaseScenario}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "#f5f3ff",
          borderRadius: "8px",
          borderLeft: "4px solid #8b5cf6",
          fontSize: "0.85rem",
          color: "#666",
        }}
      >
        <strong style={{ color: "#6d28d9" }}>📊 How to Use:</strong>
        <ul
          style={{
            margin: "0.5rem 0 0 1.5rem",
            paddingLeft: "0",
          }}
        >
          <li>
            <strong>Chaos:</strong> Introduces uncertainty into predictions
            (0% = deterministic, 100% = highly variable)
          </li>
          <li>
            <strong>Iterations:</strong> More iterations provide more accurate
            Monte Carlo simulations but take longer to compute
          </li>
          <li>
            <strong>Impact Score:</strong> How much a rival's outcome affects
            Cowboys' playoff chances (0-100)
          </li>
          <li>
            <strong>Best Case:</strong> Cowboys' playoff probability if this
            team loses their next game
          </li>
        </ul>
      </div>
    </div>
  );
}

function getUrgencyColor(urgency) {
  switch (urgency) {
    case "critical":
      return "#dc2626";
    case "high":
      return "#f59e0b";
    default:
      return "#3b82f6";
  }
}

function getTierColor(tier) {
  switch (tier) {
    case "direct_rival":
      return "#dc2626";
    case "threat":
      return "#ea580c";
    default:
      return "#0891b2";
  }
}
