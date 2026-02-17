/**
 * Maps.jsx
 * Interactive Consistency vs Explosiveness visualization
 * Displays Cowboys players across two performance dimensions
 */

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
      const result = await window.api.getPlayerMaps();
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

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw quadrant backgrounds
    drawQuadrants(ctx);

    // Draw grid
    drawGrid(ctx);

    // Draw axes
    drawAxes(ctx);

    // Draw quadrant labels
    drawQuadrantLabels(ctx);

    // Draw players
    drawPlayers(ctx);

    // Draw legend
    drawLegend(ctx);
  };

  const drawQuadrants = (ctx) => {
    const centerX = PADDING + (CANVAS_WIDTH - 2 * PADDING) / 2;
    const centerY = PADDING + (CANVAS_HEIGHT - 2 * PADDING) / 2;

    // Elite (top right) - High consistency, High explosiveness
    ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
    ctx.fillRect(centerX, PADDING, CANVAS_WIDTH - PADDING - centerX, centerY - PADDING);

    // Volatile (top left) - Low consistency, High explosiveness
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(PADDING, PADDING, centerX - PADDING, centerY - PADDING);

    // Reliable (bottom right) - High consistency, Low explosiveness
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(centerX, centerY, CANVAS_WIDTH - PADDING - centerX, CANVAS_HEIGHT - PADDING - centerY);

    // Inconsistent (bottom left) - Low consistency, Low explosiveness
    ctx.fillStyle = "rgba(107, 114, 128, 0.08)";
    ctx.fillRect(PADDING, centerY, centerX - PADDING, CANVAS_HEIGHT - PADDING - centerY);
  };

  const drawGrid = (ctx) => {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = PADDING + (i / 10) * (CANVAS_WIDTH - 2 * PADDING);
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, CANVAS_HEIGHT - PADDING);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = PADDING + (i / 10) * (CANVAS_HEIGHT - 2 * PADDING);
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(CANVAS_WIDTH - PADDING, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawAxes = (ctx) => {
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;

    // X axis
    ctx.beginPath();
    ctx.moveTo(PADDING, CANVAS_HEIGHT - PADDING);
    ctx.lineTo(CANVAS_WIDTH - PADDING, CANVAS_HEIGHT - PADDING);
    ctx.stroke();

    // Y axis
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING);
    ctx.lineTo(PADDING, CANVAS_HEIGHT - PADDING);
    ctx.stroke();

    // X axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= 10; i += 2) {
      const x = PADDING + (i / 10) * (CANVAS_WIDTH - 2 * PADDING);
      ctx.fillText(i * 10, x, CANVAS_HEIGHT - PADDING + 15);
    }

    // Y axis labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 10; i += 2) {
      const y = CANVAS_HEIGHT - PADDING - (i / 10) * (CANVAS_HEIGHT - 2 * PADDING);
      ctx.fillText(i * 10, PADDING - 15, y);
    }

    // Axis titles
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Consistency →", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 25);

    ctx.save();
    ctx.translate(20, CANVAS_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Explosiveness →", 0, 0);
    ctx.restore();
  };

  const drawQuadrantLabels = (ctx) => {
    const centerX = PADDING + (CANVAS_WIDTH - 2 * PADDING) / 2;
    const centerY = PADDING + (CANVAS_HEIGHT - 2 * PADDING) / 2;

    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Elite
    ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
    ctx.fillText("QUIETLY ELITE", centerX + (CANVAS_WIDTH - centerX - PADDING) / 2, PADDING + (centerY - PADDING) / 2);

    // Volatile
    ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
    ctx.fillText("VOLATILE", PADDING + (centerX - PADDING) / 2, PADDING + (centerY - PADDING) / 2);

    // Reliable
    ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
    ctx.fillText("RELIABLE", centerX + (CANVAS_WIDTH - centerX - PADDING) / 2, centerY + (CANVAS_HEIGHT - centerY - PADDING) / 2);

    // Inconsistent
    ctx.fillStyle = "rgba(107, 114, 128, 0.6)";
    ctx.fillText("INCONSISTENT", PADDING + (centerX - PADDING) / 2, centerY + (CANVAS_HEIGHT - centerY - PADDING) / 2);
  };

  const drawPlayers = (ctx) => {
    if (!data || !data.players) return;

    data.players.forEach((player) => {
      const x = PADDING + (player.consistency / 100) * (CANVAS_WIDTH - 2 * PADDING);
      const y = CANVAS_HEIGHT - PADDING - (player.explosiveness / 100) * (CANVAS_HEIGHT - 2 * PADDING);

      const isHovered = hoveredPlayer === player.id;
      const isInSelectedCategory =
        selectedCategory === null || player.category === selectedCategory;

      // Determine point color and size
      const color = getCategoryColor(player.category);
      const size = isHovered ? 12 : 8;
      const opacity = isInSelectedCategory ? 1 : 0.3;

      // Draw point
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // Draw outline for hovered
      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Draw tooltip
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(x + 15, y - 30, 180, 60);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(player.name, x + 20, y - 20);

        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(`Position: ${player.position}`, x + 20, y - 5);
        ctx.fillText(`Role: ${player.role}`, x + 20, y + 7);
        ctx.fillText(`Volatility: ${player.volatility}`, x + 20, y + 19);
      }

      // Draw labels
      if (showLabels && !isHovered && isInSelectedCategory) {
        ctx.fillStyle = "#4b5563";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(player.name.split(" ")[0], x, y + 12);
      }
    });
  };

  const drawLegend = (ctx) => {
    const legendX = CANVAS_WIDTH - 180;
    const legendY = 15;

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(legendX - 10, legendY, 175, 130);

    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY, 175, 130);

    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "left";
    ctx.fillText("Categories:", legendX, legendY + 10);

    const categories = [
      { color: getCategoryColor("elite"), label: "Quietly Elite" },
      { color: getCategoryColor("volatile"), label: "Volatile" },
      { color: getCategoryColor("reliable"), label: "Reliable" },
      { color: getCategoryColor("inconsistent"), label: "Inconsistent" },
    ];

    categories.forEach((cat, idx) => {
      const y = legendY + 30 + idx * 25;

      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.arc(legendX + 5, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#374151";
      ctx.textAlign = "left";
      ctx.fillText(cat.label, legendX + 15, y - 4);
    });
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "elite":
        return "#10b981";
      case "volatile":
        return "#ef4444";
      case "reliable":
        return "#3b82f6";
      case "inconsistent":
        return "#9ca3af";
      default:
        return "#6b7280";
    }
  };

  const handleCanvasHover = (event) => {
    if (!data || !data.players) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let hovered = null;

    data.players.forEach((player) => {
      const px = PADDING + (player.consistency / 100) * (CANVAS_WIDTH - 2 * PADDING);
      const py = CANVAS_HEIGHT - PADDING - (player.explosiveness / 100) * (CANVAS_HEIGHT - 2 * PADDING);

      const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (distance < 15) {
        hovered = player.id;
      }
    });

    setHoveredPlayer(hovered);
  };

  const handleCanvasLeave = () => {
    setHoveredPlayer(null);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "#666" }}>Loading player consistency/explosiveness map...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "#666" }}>No data available</p>
      </div>
    );
  }

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
          Consistency vs Explosiveness Map
        </h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Analyze Cowboys players across performance dimensions
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Main Chart */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "1.5rem",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ marginRight: "1rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                style={{ marginRight: "0.5rem", cursor: "pointer" }}
              />
              Show Player Names
            </label>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={handleCanvasHover}
            onMouseLeave={handleCanvasLeave}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              display: "block",
              cursor: "crosshair",
            }}
          />
        </div>

        {/* Sidebar with Insights */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Filter by Category */}
          <div
            style={{
              background: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              padding: "1rem",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "0.95rem", color: "#1f2937" }}>
              Filter by Category
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: "0.5rem",
                  background: selectedCategory === null ? "#0284c7" : "#f3f4f6",
                  color: selectedCategory === null ? "#fff" : "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                All Players
              </button>
              {["elite", "volatile", "reliable", "inconsistent"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "0.5rem",
                    background: selectedCategory === cat ? getCategoryColor(cat) : "#f3f4f6",
                    color: selectedCategory === cat ? "#fff" : "#374151",
                    border: `1px solid ${getCategoryColor(cat)}`,
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Box */}
          <div
            style={{
              background: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #0284c7",
              padding: "1rem",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "0.95rem", color: "#0284c7" }}>
              Total Players
            </h3>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0284c7" }}>
              {data.players.length}
            </div>
          </div>

          {/* Elite Players */}
          {data.quadrants.elite.players.length > 0 && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                borderRadius: "8px",
                border: "1px solid #10b981",
                padding: "1rem",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: "0.95rem", color: "#059669" }}>
                🌟 Quietly Elite
              </h3>
              {data.quadrants.elite.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    fontSize: "0.85rem",
                    color: "#374151",
                    marginBottom: "0.5rem",
                    padding: "0.4rem",
                    background: "#fff",
                    borderRadius: "4px",
                  }}
                >
                  <strong>{p.name}</strong> ({p.position})
                </div>
              ))}
            </div>
          )}

          {/* Volatile Players */}
          {data.quadrants.volatile.players.length > 0 && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "8px",
                border: "1px solid #ef4444",
                padding: "1rem",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: "0.95rem", color: "#dc2626" }}>
                💥 Volatile
              </h3>
              {data.quadrants.volatile.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    fontSize: "0.85rem",
                    color: "#374151",
                    marginBottom: "0.5rem",
                    padding: "0.4rem",
                    background: "#fff",
                    borderRadius: "4px",
                  }}
                >
                  <strong>{p.name}</strong> ({p.position})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights Section */}
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          padding: "2rem",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.25rem", color: "#1f2937", marginBottom: "1.5rem" }}>
          Key Insights
        </h2>

        {data.insights.length === 0 ? (
          <p style={{ color: "#999" }}>No insights available</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {data.insights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: "1.25rem",
                  borderRadius: "6px",
                  borderLeft: `4px solid ${getInsightColor(insight.type)}`,
                  background: getInsightBackground(insight.type),
                }}
              >
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#1f2937",
                    marginBottom: "0.5rem",
                  }}
                >
                  {getInsightIcon(insight.type)} {insight.title}
                </div>
                <p
                  style={{
                    margin: "0.5rem 0 0 0",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                    color: "#666",
                  }}
                >
                  {insight.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Players Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          padding: "1.5rem",
          marginTop: "2rem",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontSize: "1.25rem",
            color: "#1f2937",
            marginBottom: "1.5rem",
          }}
        >
          All Players Analysis
        </h2>

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
                <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Player
                </th>
                <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Position
                </th>
                <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Consistency
                </th>
                <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Explosiveness
                </th>
                <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Category
                </th>
                <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: 600, color: "#666" }}>
                  Volatility
                </th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player, idx) => (
                <tr
                  key={player.id}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem",
                      fontWeight: 600,
                      color: "#1f2937",
                    }}
                  >
                    {player.name}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      color: "#666",
                    }}
                  >
                    {player.position}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#3b82f6",
                    }}
                  >
                    {player.consistency}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#ef4444",
                    }}
                  >
                    {player.explosiveness}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        background: getCategoryColor(player.category),
                        color: "#fff",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "3px",
                        textTransform: "uppercase",
                      }}
                    >
                      {player.category}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: getVolatilityColor(player.volatility),
                    }}
                  >
                    {player.volatility}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.25rem",
          background: "#f5f3ff",
          borderRadius: "8px",
          borderLeft: "4px solid #8b5cf6",
          fontSize: "0.85rem",
          color: "#666",
        }}
      >
        <strong style={{ color: "#6d28d9" }}>📊 How to Read the Map:</strong>
        <ul style={{ margin: "0.75rem 0 0 1.5rem", paddingLeft: "0" }}>
          <li>
            <strong>Consistency (X-axis):</strong> Higher values = more reliable, predictable performance
          </li>
          <li>
            <strong>Explosiveness (Y-axis):</strong> Higher values = more big-play potential and peak performance
          </li>
          <li>
            <strong>Top-Right (Quietly Elite):</strong> The best of both worlds - reliable AND explosive
          </li>
          <li>
            <strong>Top-Left (Volatile):</strong> High ceiling but unpredictable - high risk/reward
          </li>
          <li>
            <strong>Bottom-Right (Reliable):</strong> Steady performers - you know what you're getting
          </li>
          <li>
            <strong>Bottom-Left (Inconsistent):</strong> Underperformers on both dimensions
          </li>
        </ul>
      </div>
    </div>
  );
}

function getInsightColor(type) {
  switch (type) {
    case "strength":
      return "#10b981";
    case "opportunity":
      return "#f59e0b";
    case "consistency":
      return "#3b82f6";
    case "concern":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function getInsightBackground(type) {
  switch (type) {
    case "strength":
      return "rgba(16, 185, 129, 0.1)";
    case "opportunity":
      return "rgba(245, 158, 11, 0.1)";
    case "consistency":
      return "rgba(59, 130, 246, 0.1)";
    case "concern":
      return "rgba(239, 68, 68, 0.1)";
    default:
      return "rgba(107, 114, 128, 0.1)";
  }
}

function getInsightIcon(type) {
  switch (type) {
    case "strength":
      return "✅";
    case "opportunity":
      return "🎯";
    case "consistency":
      return "📊";
    case "concern":
      return "⚠️";
    default:
      return "📌";
  }
}

function getVolatilityColor(volatility) {
  switch (volatility) {
    case "VOLATILE":
      return "#ef4444";
    case "RISKY":
      return "#f97316";
    case "STABLE":
      return "#10b981";
    case "PREDICTABLE":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
}

window.Maps = Maps;
