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
        const BASE =
          window.location.hostname === "localhost"
            ? "http://localhost:3001"
            : window.location.origin;

        const res = await fetch(`${BASE}/api/timeline?season=${season}`);
        if (!res.ok) {
          throw new Error(`Failed to load timeline for ${season}.`);
        }

        const json = await res.json();
        if (cancelled) return;

        const normalizedEvents = Array.isArray(json.events)
          ? json.events
          : Array.isArray(json.timeline)
          ? json.timeline
          : [];

        setEvents(normalizedEvents);
        setSelectedEvent(normalizedEvents[0] || null);

        if (!normalizedEvents.length) {
          setTimelineReason("No timeline events were returned for this season.");
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
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="intel-feed-main">
                        <div className="intel-feed-title">{getEventTitle(event)}</div>
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
              <div className="intel-stack">
                <div className="intel-badge">{getEventTitle(selectedEvent)}</div>
                <div className="intel-note">
                  {formatShortDate(getEventDate(selectedEvent))}
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
