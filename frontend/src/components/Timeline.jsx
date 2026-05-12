import React from "react";
import { api } from "../api";

function toTitleCase(str) {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventBadgeClass(event) {
  const raw = (
    event.type ||
    event.eventType ||
    event.category ||
    event.title ||
    event.name ||
    event.label ||
    event.event ||
    ""
  ).toLowerCase();

  if (raw.includes("win") || raw.includes("victory")) return "intel-badge--success";
  if (raw.includes("loss") || raw.includes("blowout") || raw.includes("defeat")) return "intel-badge--danger";
  if (raw.includes("injury") || raw.includes("suspend")) return "intel-badge--warning";
  return "intel-badge--neutral";
}

function getFeedAccentStyle(event) {
  const cls = getEventBadgeClass(event);
  if (cls === "intel-badge--success") return { borderLeft: "3px solid rgba(120,225,191,0.5)" };
  if (cls === "intel-badge--danger") return { borderLeft: "3px solid rgba(255,123,135,0.5)" };
  if (cls === "intel-badge--warning") return { borderLeft: "3px solid rgba(245,198,105,0.5)" };
  return { borderLeft: "3px solid rgba(138,168,209,0.35)" };
}

function Timeline() {
  const [season, setSeason] = React.useState(2025);
  const [events, setEvents] = React.useState([]);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [timelineReason, setTimelineReason] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      setTimelineReason("");

      try {
        if (!api?.getTimelineFull && !api?.getTimelinePoints) {
          throw new Error("Timeline API is unavailable.");
        }

        const json = api.getTimelineFull
          ? await api.getTimelineFull(season)
          : await api.getTimelinePoints(season);

        if (cancelled) return;

        const normalizedEvents = Array.isArray(json.events)
          ? json.events
          : Array.isArray(json.timeline)
          ? json.timeline
          : [];

        setEvents(normalizedEvents);
        setSelectedEvent(normalizedEvents[0] || null);

        if (!normalizedEvents.length) {
          setTimelineReason(json.reason || "No timeline events were returned for this season.");
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setSelectedEvent(null);
          setError(err.message || "Unable to load timeline.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [season]);

  function getEventTitle(event) {
    return (
      event.title ||
      event.name ||
      event.label ||
      event.event ||
      "Timeline Event"
    );
  }

  function getEventDate(event) {
    return (
      event.date ||
      event.eventDate ||
      event.occurredAt ||
      event.timestamp ||
      ""
    );
  }

  function getEventBody(event) {
    return (
      event.description ||
      event.summary ||
      event.body ||
      event.reason ||
      "No additional detail available for this event."
    );
  }

  function formatShortDate(value) {
    if (!value) return "Date unavailable";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Timeline Intelligence</div>
          <h1 className="intel-title">Season Momentum Tracker</h1>
          <p className="intel-subtitle">
            Track major inflection points, turning moments, and team narrative across the season.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{season}</div>
          <div className="intel-chip intel-chip--muted">{events.length} Events</div>
        </div>
      </section>

      {timelineReason && (
        <div className="intel-banner intel-banner--warning">{timelineReason}</div>
      )}

      {error && (
        <div className="intel-banner intel-banner--warning">{error}</div>
      )}

      <section className="intel-panel">
        <div className="intel-control-grid">
          <div className="intel-form-group">
            <label className="intel-label">Season</label>
            <select
              className="intel-select"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
            >
              {[2026, 2025, 2024, 2023].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="intel-panel">
          <div className="intel-note">Loading timeline…</div>
        </section>
      ) : (
        <section className="intel-grid intel-grid--main">
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Event Feed</h3>
            </div>

            {!events.length ? (
              <div className="intel-empty">No timeline events available.</div>
            ) : (
              <div className="intel-feed timeline-events">
                {events.map((event, index) => {
                  const isActive = selectedEvent === event;
                  return (
                    <button
                      key={`${getEventTitle(event)}-${index}`}
                      type="button"
                      className={`intel-feed-item ${isActive ? "active" : ""}`}
                      style={getFeedAccentStyle(event)}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="intel-feed-main">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={`intel-badge ${getEventBadgeClass(event)}`} style={{ fontSize: "0.65rem", padding: "0.2rem 0.45rem" }}>
                            {toTitleCase(getEventTitle(event))}
                          </span>
                        </div>
                        <div className="intel-feed-meta">
                          {formatShortDate(getEventDate(event))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </article>

          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Event Detail</h3>
            </div>

            {!selectedEvent ? (
              <div className="intel-empty">Select an event to view details.</div>
            ) : (
              <div className="intel-stack" style={{ gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span className={`intel-badge ${getEventBadgeClass(selectedEvent)}`}>
                    {toTitleCase(getEventTitle(selectedEvent))}
                  </span>
                  <span style={{ color: "#99abc1", fontSize: "0.85rem" }}>
                    {formatShortDate(getEventDate(selectedEvent))}
                  </span>
                </div>
                <div className="intel-story-panel">{getEventBody(selectedEvent)}</div>
              </div>
            )}
          </article>
        </section>
      )}
    </div>
  );
}

window.Timeline = Timeline;

export default Timeline;
