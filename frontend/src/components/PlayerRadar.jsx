function PlayerRadar() {
  const [payload, setPayload] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [activeId, setActiveId] = React.useState("dak");
  const [visible, setVisible] = React.useState({
    dak: true,
    ceedee: true,
    bland: true,
  });

  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    const BASE =
      window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : window.location.origin;

    fetch(`${BASE}/api/players/radar`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load player radar.");
        }
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;

        const labels = json.labels || [
          "Offense",
          "Explosiveness",
          "Consistency",
          "Clutch",
          "Durability",
        ];

        const players = (json.players || []).map((p, index) => {
          const lower = String(p.name || "").toLowerCase();
          let id = p.id || `player_${index}`;

          if (lower.includes("prescott")) id = "dak";
          else if (lower.includes("lamb")) id = "ceedee";
          else if (lower.includes("bland")) id = "bland";

          const m = p.metrics || {};
          return {
            id,
            name: p.name || "Unknown Player",
            position: p.position || "N/A",
            role: p.role || "",
            metrics: {
              offense: Number(m.offense || 0),
              explosiveness: Number(m.explosiveness || 0),
              consistency: Number(m.consistency || 0),
              clutch: Number(m.clutch || 0),
              durability: Number(m.durability || 0),
            },
          };
        });

        setPayload({ labels, players });

        if (players.length > 0) {
          setActiveId(players[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Unable to load player radar.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!payload || !canvasRef.current || !window.Chart) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const palette = {
      dak: {
        border: "rgba(0, 212, 170, 1)",
        fill: "rgba(0, 212, 170, 0.16)",
      },
      ceedee: {
        border: "rgba(69, 224, 255, 1)",
        fill: "rgba(69, 224, 255, 0.16)",
      },
      bland: {
        border: "rgba(245, 184, 61, 1)",
        fill: "rgba(245, 184, 61, 0.14)",
      },
      fallback: {
        border: "rgba(232, 238, 245, 0.9)",
        fill: "rgba(232, 238, 245, 0.12)",
      },
    };

    const datasets = payload.players
      .filter((player) => visible[player.id])
      .map((player) => {
        const colors = palette[player.id] || palette.fallback;
        return {
          label: `${player.name} (${player.position})`,
          data: [
            player.metrics.offense,
            player.metrics.explosiveness,
            player.metrics.consistency,
            player.metrics.clutch,
            player.metrics.durability,
          ],
          borderColor: colors.border,
          backgroundColor: colors.fill,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 4,
          fill: true,
        };
      });

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new window.Chart(ctx, {
      type: "radar",
      data: {
        labels: payload.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
        },
        plugins: {
          legend: {
            labels: {
              color: "#d8e1ea",
              boxWidth: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: "rgba(10, 18, 28, 0.96)",
            titleColor: "#f8fbff",
            bodyColor: "#d8e1ea",
            borderColor: "rgba(150, 174, 198, 0.18)",
            borderWidth: 1,
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              display: false,
              stepSize: 20,
            },
            grid: {
              color: "rgba(150, 174, 198, 0.16)",
            },
            angleLines: {
              color: "rgba(150, 174, 198, 0.12)",
            },
            pointLabels: {
              color: "#a8b7c6",
              font: {
                size: 12,
                weight: "600",
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

  const activePlayer =
    payload?.players?.find((player) => player.id === activeId) ||
    payload?.players?.[0] ||
    null;

  function toggleVisible(id) {
    setVisible((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  if (loading) {
    return (
      <div className="intel-panel">
        <div className="intel-section-title">Player Radar</div>
        <div className="intel-note">Loading radar data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-panel">
        <div className="intel-section-title">Player Radar</div>
        <div className="intel-banner intel-banner--warning">{error}</div>
      </div>
    );
  }

  if (!payload || !payload.players || payload.players.length === 0) {
    return (
      <div className="intel-panel">
        <div className="intel-section-title">Player Radar</div>
        <div className="intel-empty">No radar data available.</div>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Player Intelligence</div>
          <h1 className="intel-title">Radar Comparison</h1>
          <p className="intel-subtitle">
            Compare player profiles across core impact dimensions.
          </p>
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h3 className="intel-section-title">Radar View</h3>
          </div>

          <div className="radar-shell">
            <canvas ref={canvasRef} />
          </div>
        </article>

        <article className="intel-stack">
          <div className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Players</h3>
            </div>

            <div className="intel-feed">
              {payload.players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`intel-feed-item ${activeId === player.id ? "active" : ""}`}
                  onClick={() => setActiveId(player.id)}
                >
                  <div className="intel-feed-main">
                    <div className="intel-feed-title">{player.name}</div>
                    <div className="intel-feed-meta">
                      {player.position} {player.role ? `• ${player.role}` : ""}
                    </div>
                  </div>

                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="checkbox"
                      checked={!!visible[player.id]}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleVisible(player.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="muted">Show</span>
                  </label>
                </button>
              ))}
            </div>
          </div>

          <div className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Selected Player</h3>
            </div>

            {!activePlayer ? (
              <div className="intel-empty">Select a player to inspect details.</div>
            ) : (
              <div className="intel-stack">
                <div className="intel-badge">{activePlayer.name}</div>
                <div className="intel-note">
                  {activePlayer.position} {activePlayer.role ? `• ${activePlayer.role}` : ""}
                </div>

                <div className="intel-metric-grid">
                  <div className="intel-metric-card">
                    <div className="intel-metric-card__label">Offense</div>
                    <div className="intel-metric-card__value">{activePlayer.metrics.offense}</div>
                  </div>
                  <div className="intel-metric-card">
                    <div className="intel-metric-card__label">Explosiveness</div>
                    <div className="intel-metric-card__value">{activePlayer.metrics.explosiveness}</div>
                  </div>
                  <div className="intel-metric-card">
                    <div className="intel-metric-card__label">Consistency</div>
                    <div className="intel-metric-card__value">{activePlayer.metrics.consistency}</div>
                  </div>
                  <div className="intel-metric-card">
                    <div className="intel-metric-card__label">Clutch</div>
                    <div className="intel-metric-card__value">{activePlayer.metrics.clutch}</div>
                  </div>
                  <div className="intel-metric-card">
                    <div className="intel-metric-card__label">Durability</div>
                    <div className="intel-metric-card__value">{activePlayer.metrics.durability}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

window.PlayerRadar = PlayerRadar;
