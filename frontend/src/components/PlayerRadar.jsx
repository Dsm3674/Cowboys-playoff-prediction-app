import React from "react";
import { api } from "../api";

function PlayerRadar() {
  const [payload, setPayload] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeId, setActiveId] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadRadar() {
      try {
        setLoading(true);
        setError("");
        if (!api?.getPlayerRadar) {
          throw new Error("Player radar API is unavailable.");
        }

        const json = await api.getPlayerRadar(new Date().getFullYear());

        const labels = Array.isArray(json.labels) && json.labels.length
          ? json.labels
          : ["Offense", "Explosiveness", "Consistency", "Clutch", "Durability"];

        const players = (json.players || []).map((p, index) => {
          const metrics = p.metrics || {};
          const id = p.id || `player_${index}`;

          return {
            id,
            name: p.name || "Unknown Player",
            position: p.position || "N/A",
            role: p.role || "",
            metrics: {
              offense: Number(metrics.offense || 0),
              explosiveness: Number(metrics.explosiveness || 0),
              consistency: Number(metrics.consistency || 0),
              clutch: Number(metrics.clutch || 0),
              durability: Number(metrics.durability || 0),
            }
          };
        });

        if (!cancelled) {
          setPayload({ labels, players });
          setActiveId(players[0]?.id || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load player radar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRadar();
    return () => {
      cancelled = true;
    };
  }, []);

  function avg(metrics) {
    const values = Object.values(metrics || {});
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
  }

  function tier(score) {
    if (score >= 85) return "Elite";
    if (score >= 72) return "Impact";
    if (score >= 58) return "Starter";
    return "Depth";
  }

  function tone(score) {
    if (score >= 85) return "intel-badge intel-badge--success";
    if (score >= 72) return "intel-badge intel-badge--neutral";
    if (score >= 58) return "intel-badge intel-badge--warning";
    return "intel-badge intel-badge--danger";
  }

  const players = payload?.players || [];
  const active = players.find((p) => p.id === activeId) || players[0] || null;

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-skeleton" style={{ height: 180 }} />
          <div className="intel-skeleton" style={{ height: 320, marginTop: 18 }} />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-empty">{error}</div>
        </section>
      </div>
    );
  }

  if (!players.length) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-empty">No player radar data available.</div>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <section className="intel-hero intel-hero--compact">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Players Intelligence</div>
          <h1 className="intel-title">Cowboys Scouting Board</h1>
          <p className="intel-subtitle">
            Compare offensive upside, consistency, clutch performance, and durability in a cleaner board built to feel more like a real front-office scouting surface.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Star Watch</div>
          <div className="intel-chip intel-chip--muted">{players.length} player profiles</div>
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Roster Board</h2>
          </div>

          <div className="player-radar-list">
            {players.map((player) => {
              const score = avg(player.metrics);
              const isActive = active?.id === player.id;

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`player-radar-card ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveId(player.id)}
                >
                  <div className="player-radar-card__top">
                    <div>
                      <div className="player-radar-card__name">{player.name}</div>
                      <div className="player-radar-card__meta">
                        {player.position}{player.role ? ` · ${player.role}` : ""}
                      </div>
                    </div>

                    <div className={tone(score)}>
                      {tier(score)}
                    </div>
                  </div>

                  <div className="player-radar-score-row">
                    <div className="player-radar-score">{score.toFixed(1)}</div>
                    <div className="player-radar-score-label">Composite</div>
                  </div>

                  <div className="player-radar-mini-bars">
                    {Object.entries(player.metrics).map(([key, value]) => (
                      <div className="player-radar-mini" key={key}>
                        <div className="player-radar-mini__label">{key}</div>
                        <div className="player-radar-mini__track">
                          <span style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Star Profile</h2>
          </div>

          {active ? (
            <div className="player-radar-detail">
              <div className="player-radar-detail__hero">
                <div>
                  <div className="player-radar-detail__name">{active.name}</div>
                  <div className="player-radar-detail__meta">
                    {active.position}{active.role ? ` · ${active.role}` : ""}
                  </div>
                </div>

                <div className="player-radar-detail__score-wrap">
                  <div className="player-radar-detail__score">{avg(active.metrics).toFixed(1)}</div>
                  <div className="player-radar-detail__score-label">Star grade</div>
                </div>
              </div>

              <div className="player-radar-metric-grid">
                {Object.entries(active.metrics).map(([key, value]) => (
                  <div className="player-radar-metric" key={key}>
                    <div className="player-radar-metric__header">
                      <span>{key}</span>
                      <strong>{Number(value).toFixed(0)}</strong>
                    </div>
                    <div className="player-radar-metric__track">
                      <span style={{ width: `${Math.max(6, Math.min(100, value))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="intel-empty">Select a player.</div>
          )}
        </article>
      </section>
    </div>
  );
}

window.PlayerRadar = PlayerRadar;

export default PlayerRadar;
