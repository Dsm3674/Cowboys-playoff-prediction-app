function PlayerRadar() {
  const [payload, setPayload] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // which player we’re “focused” on for the text section
  const [activeId, setActiveId] = React.useState("dak");

  // which players are drawn on the chart
  const [visible, setVisible] = React.useState({
    dak: true,
    ceedee: true,
    bland: true,
  });

  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  // ---- Fetch data from backend ----------------------------------
  React.useEffect(() => {
    setLoading(true);
    setError(null);

    const BASE =
      window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : window.location.origin;

    fetch(`${BASE}/api/players/radar`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load player radar");
        return res.json();
      })
      .then((json) => {
        // Normalize structure a bit defensively
        const labels = json.labels || [
          "Offense",
          "Explosiveness",
          "Consistency",
          "Clutch",
          "Durability",
        ];

        const players = (json.players || []).map((p) => {
          const lower = (p.name || "").toLowerCase();
          let id = p.id || "dak";
          if (lower.includes("prescott")) id = "dak";
          else if (lower.includes("lamb")) id = "ceedee";
          else if (lower.includes("bland")) id = "bland";

          const m = p.metrics || {};
          return {
            id,
            name: p.name,
            position: p.position,
            role: p.role || "",
            metrics: {
              offense: m.offense || 0,
              explosiveness: m.explosiveness || 0,
              consistency: m.consistency || 0,
              clutch: m.clutch || 0,
              durability: m.durability || 0,
            },
          };
        });

        setPayload({ labels, players });
        if (players.some((p) => p.id === "bland")) {
          setActiveId("bland"); // focus Bland by default if present
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ---- Build / update Chart.js radar ----------------------------
  React.useEffect(() => {
    if (!payload || !canvasRef.current || !window.Chart) return;

    // clean up old chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext("2d");
    const labels = payload.labels;

    const palette = {
      dak: {
        bg: "rgba(0, 53, 148, 0.25)",
        border: "rgba(0, 53, 148, 1)",
      },
      ceedee: {
        bg: "rgba(255, 107, 53, 0.25)",
        border: "rgba(255, 107, 53, 1)",
      },
      bland: {
        bg: "rgba(30, 144, 255, 0.25)", // DodgerBlue-ish
        border: "rgba(30, 144, 255, 1)",
      },
    };

    const datasets = payload.players
      .filter((p) => visible[p.id])
      .map((p) => {
        const m = p.metrics;
        const vals = [
          m.offense,
          m.explosiveness,
          m.consistency,
          m.clutch,
          m.durability,
        ];
        const colors = palette[p.id] || palette.dak;

        return {
          label: p.name,
          data: vals,
          fill: true,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          pointBackgroundColor: colors.border,
          borderWidth: 2,
        };
      });

    chartRef.current = new window.Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            suggestedMin: 60,
            suggestedMax: 100,
            ticks: {
              stepSize: 10,
            },
            grid: {
              color: "rgba(148, 163, 184, 0.4)",
            },
            angleLines: {
              color: "rgba(148, 163, 184, 0.4)",
            },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return `${ctx.dataset.label}: ${ctx.formattedValue}`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [payload, visible]);

  // ---- UI helpers -----------------------------------------------
  const toggleVisible = (id) => {
    setVisible((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const setActive = (id) => {
    setActiveId(id);
    // if they accidentally hid a player, make sure it shows when activated
    setVisible((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const getActivePlayer = () => {
    if (!payload) return null;
    return (
      payload.players.find((p) => p.id === activeId) || payload.players[0] || null
    );
  };

  const activePlayer = getActivePlayer();

  if (loading) {
    return (
      <div className="card">
        <h3>Player Impact Radar</h3>
        <p>Loading player impact...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Player Impact Radar</h3>
        <p style={{ color: "red" }}>Error: {error}</p>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="card">
      <h3>Player Impact Radar</h3>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        How Dallas&rsquo;s core stars shape win probability across offense,
        explosiveness, consistency, clutch, and durability.
      </p>

      {/* Toggle bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          margin: "0.75rem 0 1rem",
        }}
      >
        {["dak", "ceedee", "bland"].map((id) => {
          const p = payload.players.find((pl) => pl.id === id);
          if (!p) return null;

          const isActive = activeId === id;
          const isVisible = visible[id];

          const baseStyles = {
            flex: 1,
            borderRadius: "10px",
            padding: "0.6rem 0.75rem",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "2px solid #000",
            cursor: "pointer",
            boxShadow: isActive ? "4px 4px 0 #000" : "2px 2px 0 #000",
            opacity: isVisible ? 1 : 0.4,
            color: "#fff",
          };

          let bg = "#003594";
          if (id === "ceedee") bg = "#ff6b35";
          if (id === "bland") bg = "#1e90ff";

          return (
            <button
              key={id}
              type="button"
              style={{ ...baseStyles, background: bg }}
              onClick={() => setActive(id)}
              onDoubleClick={() => toggleVisible(id)}
              title={
                isVisible
                  ? "Double-click to hide from chart"
                  : "Double-click to show on chart"
              }
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Radar Chart */}
      <div
        style={{
          height: "320px",
          marginBottom: "1rem",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Active player detail */}
      {activePlayer && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>
              {activePlayer.name} &mdash; {activePlayer.position}
            </strong>
            {activePlayer.role && (
              <span style={{ color: "#6b7280" }}> · {activePlayer.role}</span>
            )}
          </div>

          <ul
            style={{
              listStyle: "none",
              paddingLeft: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.25rem 1rem",
            }}
          >
            {[
              ["Offense", activePlayer.metrics.offense],
              ["Explosiveness", activePlayer.metrics.explosiveness],
              ["Consistency", activePlayer.metrics.consistency],
              ["Clutch", activePlayer.metrics.clutch],
              ["Durability", activePlayer.metrics.durability],
            ].map(([label, value]) => (
              <li key={label}>
                <strong>{label}:</strong> {value}
              </li>
            ))}
          </ul>

          <hr style={{ margin: "1rem 0 0.75rem" }} />

          <p style={{ fontSize: "0.8rem", color: "#4b5563" }}>
            <strong>What these metrics mean:</strong> Offense &mdash; drive
            impact and scoring production. Explosiveness &mdash; big-play
            creation. Consistency &mdash; week-to-week reliability. Clutch
            &mdash; high-leverage performance. Durability &mdash; availability
            and ability to hold up over a full season.
          </p>
        </div>
      )}
    </div>
  );
}

window.PlayerRadar = PlayerRadar;


