/**
 * ClutchIndex.jsx
 * Interactive Clutch Performance visualization
 * Displays Cowboys players' performance in high-leverage situations
 */

function ClutchIndex() {
  const canvasRef = React.useRef(null);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedSituation, setSelectedSituation] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("clutchIndex");
  const [sortOrder, setSortOrder] = React.useState("desc");

  const CANVAS_WIDTH = 900;
  const CANVAS_HEIGHT = 500;
  const PADDING = 60;

  React.useEffect(() => {
    loadClutchData();
  }, []);

  const loadClutchData = async () => {
    try {
      setLoading(true);
      const result = await window.api.getClutchIndex();
      setData(result);
    } catch (error) {
      console.error("Error loading clutch data:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (data && canvasRef.current) {
      drawVisualization();
    }
  }, [data, selectedSituation]);

  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw title
    drawTitle(ctx);

    // Draw leadership rankings
    drawLeadershipRankings(ctx);

    // Draw underperformers
    drawUnderperformers(ctx);

    // Draw situational breakdown
    drawSituationalBreakdown(ctx);
  };

  const drawTitle = (ctx) => {
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "left";
    ctx.fillText("Clutch Performance Index", 20, 30);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("High-leverage situation analysis (4th quarter, red zone, close games, etc.)", 20, 48);
  };

  const drawLeadershipRankings = (ctx) => {
    const startX = 20;
    const startY = 70;

    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Clutch Leaders", startX, startY);

    const leaders = data?.leaders || [];
    leaders.slice(0, 3).forEach((player, idx) => {
      const y = startY + 25 + idx * 30;

      // Medal indicator
      const medals = ["🥇", "🥈", "🥉"];
      ctx.font = "16px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(medals[idx] || "•", startX, y);

      // Player name and ranking
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "left";
      ctx.fillText(player.name, startX + 25, y - 2);

      // Ranking tier
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(player.ranking, startX + 25, y + 12);

      // Clutch score
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "right";
      ctx.fillText(`${player.clutchIndex.toFixed(1)}/100`, startX + 200, y - 2);
    });
  };

  const drawUnderperformers = (ctx) => {
    const startX = 250;
    const startY = 70;

    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Need Clutch Step-Up", startX, startY);

    const underperformers = data?.underperformers || [];
    underperformers.slice(0, 3).forEach((player, idx) => {
      const y = startY + 25 + idx * 30;

      // Warning indicator
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.fillText("⚠", startX, y);

      // Player name and ranking
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.fillText(player.name, startX + 25, y - 2);

      // Ranking tier
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(player.ranking, startX + 25, y + 12);

      // Clutch score
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "right";
      ctx.fillText(`${player.clutchIndex.toFixed(1)}/100`, startX + 200, y - 2);
    });
  };

  const drawSituationalBreakdown = (ctx) => {
    const startX = 480;
    const startY = 70;
    const width = 400;
    const height = 150;

    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Team Clutch Situation Analysis", startX, startY);

    const situations = data?.teamStats?.situationAnalysis || [];

    const boxHeight = height / Math.min(situations.length, 3);
    situations.slice(0, 3).forEach((situation, idx) => {
      const y = startY + 25 + idx * 50;

      // Situation name
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#1f2937";
      ctx.textAlign = "left";
      ctx.fillText(situation.situation, startX, y);

      // Bar chart
      const barWidth = (width - 20) * 0.7;
      const barHeight = 12;
      const percentage = situation.performance / 100;

      // Background bar
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(startX, y + 8, barWidth, barHeight);

      // Performance bar
      ctx.fillStyle = getPerformanceColor(situation.performance);
      ctx.fillRect(startX, y + 8, barWidth * percentage, barHeight);

      // Performance value
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "left";
      ctx.fillText(`${situation.performance.toFixed(0)}/100`, startX + barWidth + 10, y + 17);
    });
  };

  const getPerformanceColor = (performance) => {
    if (performance >= 75) return "#10b981";
    if (performance >= 60) return "#f59e0b";
    if (performance >= 45) return "#f97316";
    return "#ef4444";
  };

  const getSortedPlayers = () => {
    if (!data || !data.players) return [];

    const players = [...data.players];

    // Filter by situation if needed
    if (selectedSituation !== "all") {
      // This would filter by specific situation metrics if expanded
    }

    // Sort
    players.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return players;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getRankingColor = (ranking) => {
    switch (ranking) {
      case "CLUTCH_KING":
        return "#10b981";
      case "RELIABLE_PERFORMER":
        return "#3b82f6";
      case "NEUTRAL":
        return "#6b7280";
      case "INCONSISTENT":
        return "#f97316";
      case "CHOKE_PRONE":
        return "#ef4444";
      case "CLUTCH_DEPENDENT":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  };

  const getRankingLabel = (ranking) => {
    switch (ranking) {
      case "CLUTCH_KING":
        return "Clutch King";
      case "RELIABLE_PERFORMER":
        return "Reliable Performer";
      case "NEUTRAL":
        return "Neutral";
      case "INCONSISTENT":
        return "Inconsistent";
      case "CHOKE_PRONE":
        return "Choke-Prone";
      case "CLUTCH_DEPENDENT":
        return "Clutch Dependent";
      default:
        return ranking;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: "18px", marginBottom: "10px" }}>Loading clutch analysis...</div>
        <div style={{ fontSize: "14px" }}>Analyzing high-leverage performance...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "16px" }}>Failed to load clutch data</div>
      </div>
    );
  }

  const sortedPlayers = getSortedPlayers();

  return (
    <div style={{ padding: "20px", backgroundColor: "#ffffff", borderRadius: "8px" }}>
      {/* Canvas Visualization */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          marginBottom: "30px",
          backgroundColor: "#f8fafc",
          display: "block",
        }}
      />

      {/* Situation Filter */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", color: "#374151" }}>Situation Filter:</span>
        <select
          value={selectedSituation}
          onChange={(e) => setSelectedSituation(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <option value="all">All Situations</option>
          <option value="4q">4th Quarter</option>
          <option value="leverage">High-Leverage Downs</option>
          <option value="redzone">Red Zone</option>
          <option value="closegame">Close Games</option>
          <option value="2min">Two-Minute Drill</option>
          <option value="gamewinning">Game-Winning Drives</option>
        </select>
      </div>

      {/* Detailed Players Table */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          marginTop: "20px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f3f4f6",
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => handleSort("name")}
              >
                Player {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => handleSort("position")}
              >
                Position {sortBy === "position" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                  backgroundColor: "#fef3c7",
                }}
                onClick={() => handleSort("clutchIndex")}
              >
                Clutch Index {sortBy === "clutchIndex" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => handleSort("clutchFactor")}
              >
                Factor {sortBy === "clutchFactor" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => handleSort("ranking")}
              >
                Ranking {sortBy === "ranking" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#374151" }}>
                Metrics
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: "1px solid #e5e7eb",
                  backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                  transition: "backgroundColor 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#f9fafb")
                }
              >
                <td style={{ padding: "12px", fontWeight: "600", color: "#1f2937" }}>
                  {player.name}
                </td>
                <td style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                  {player.position}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#fef3c7",
                    color: getPerformanceColor(player.clutchIndex),
                  }}
                >
                  {player.clutchIndex.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: "600",
                    color: player.clutchFactor > 0 ? "#10b981" : player.clutchFactor < 0 ? "#ef4444" : "#6b7280",
                  }}
                >
                  {player.clutchFactor > 0 ? "+" : ""}
                  {player.clutchFactor.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: "600",
                    color: getRankingColor(player.ranking),
                  }}
                >
                  {getRankingLabel(player.ranking)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px",
                      fontSize: "11px",
                    }}
                  >
                    <div>4Q: {player.metrics?.fourthQuarterPerf?.toFixed(0) || "N/A"}</div>
                    <div>Leverage: {player.metrics?.highLeveragePerf?.toFixed(0) || "N/A"}</div>
                    <div>RZ: {player.metrics?.redZonePerf?.toFixed(0) || "N/A"}</div>
                    <div>Close: {player.metrics?.closeGamePerf?.toFixed(0) || "N/A"}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          marginTop: "30px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
        }}
      >
        <div
          style={{
            padding: "15px",
            backgroundColor: "#ecfdf5",
            border: "1px solid #10b981",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#059669", fontWeight: "bold", marginBottom: "5px" }}>
            Clutch King Count
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
            {data.players?.filter((p) => p.ranking === "CLUTCH_KING").length || 0}
          </div>
        </div>

        <div
          style={{
            padding: "15px",
            backgroundColor: "#fef2f2",
            border: "1px solid #ef4444",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: "bold", marginBottom: "5px" }}>
            Needs Support
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ef4444" }}>
            {data.players?.filter((p) => p.ranking === "CHOKE_PRONE" || p.ranking === "INCONSISTENT").length ||
              0}
          </div>
        </div>

        <div
          style={{
            padding: "15px",
            backgroundColor: "#eff6ff",
            border: "1px solid #3b82f6",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: "bold", marginBottom: "5px" }}>
            Team Avg Clutch Index
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}>
            {(
              data.players?.reduce((sum, p) => sum + p.clutchIndex, 0) / (data.players?.length || 1) ||
              0
            ).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Key Insights */}
      {data.insights && data.insights.length > 0 && (
        <div
          style={{
            marginTop: "30px",
            padding: "15px",
            backgroundColor: "#f0f9ff",
            border: "1px solid #0ea5e9",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontWeight: "bold", color: "#0c4a6e", marginBottom: "10px" }}>Key Insights</div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              color: "#374151",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            {data.insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

window.ClutchIndex = ClutchIndex;
