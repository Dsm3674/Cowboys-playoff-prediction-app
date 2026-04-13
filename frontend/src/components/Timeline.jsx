function Timeline() {
  const canvasRef = React.useRef(null);

  const [events, setEvents] = React.useState([]);
  const [season, setSeason] = React.useState(2025);
  const [timelineData, setTimelineData] = React.useState([]);
  const [inflectionPoints, setInflectionPoints] = React.useState([]);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [timelineReason, setTimelineReason] = React.useState("");

  const canvasWidth = 1000;
  const canvasHeight = 400;

  // KEEP all your fetch + draw logic EXACTLY the same
  // (fetchEvents, fetchTimeline, loadData, drawTimeline etc.)

  React.useEffect(() => {
    loadData();
  }, [season]);

  React.useEffect(() => {
    drawTimeline();
  }, [timelineData, inflectionPoints, events, error, timelineReason, season]);

  const headline = React.useMemo(() => {
    if (!timelineData.length) {
      return "Season momentum data unavailable.";
    }
    return `Tracking ${season} season momentum with ${timelineData.length} timeline points and ${inflectionPoints.length} inflection signals.`;
  }, [timelineData, inflectionPoints, season]);

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Timeline Intelligence</div>
          <h1 className="intel-title">Season Momentum Tracker</h1>
          <p className="intel-subtitle">{headline}</p>
          <p className="intel-note">
            Visualize performance trends, inflection points, and key player-driven events across the season.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{season}</div>
          <div className="intel-chip intel-chip--muted">
            {events.length} Events
          </div>
        </div>
      </section>

      {/* ERROR / WARNING */}
      {timelineReason && (
        <div className="intel-banner intel-banner--warning">
          {timelineReason}
        </div>
      )}

      {error && (
        <div className="intel-banner intel-banner--warning">
          {error}
        </div>
      )}

      {/* CONTROLS */}
      <section className="intel-panel">
        <div className="intel-control-grid">

          <div className="intel-form-group">
            <label className="intel-label">Season</label>
            <input
              className="intel-input"
              type="number"
              value={season}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSeason(Number.isFinite(val) ? val : 2025);
              }}
            />
          </div>

          <button
            className="intel-button intel-button--primary"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Reloading..." : "Reload"}
          </button>

        </div>
      </section>

      {/* MAIN GRID */}
      <section className="intel-grid intel-grid--main">

        {/* CANVAS */}
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Performance Timeline</h2>
          </div>

          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="intel-canvas"
          />
        </article>

        {/* SIDEBAR */}
        <div className="intel-stack">

          {/* EVENTS LIST */}
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Events</h3>
            </div>

            {loading ? (
              <div className="intel-empty">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="intel-empty">No events found.</div>
            ) : (
              <div className="intel-feed">
                {events.map((event, i) => {
                  const title = getEventTitle(event);
                  const date = getEventDate(event);
                  const isActive =
                    selectedEvent &&
                    getEventTitle(selectedEvent) === title &&
                    getEventDate(selectedEvent) === date;

                  return (
                    <div
                      key={i}
                      className={`intel-feed-item ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="intel-feed-main">
                        <div className="intel-feed-title">
                          {title}
                        </div>
                        <div className="intel-feed-meta">
                          {formatShortDate(date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* SELECTED EVENT */}
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Event Detail</h3>
            </div>

            {!selectedEvent ? (
              <div className="intel-empty">
                Select an event to view details.
              </div>
            ) : (
              <div className="intel-stack">

                <div className="intel-badge">
                  {getEventTitle(selectedEvent)}
                </div>

                <div className="intel-note">
                  {formatShortDate(getEventDate(selectedEvent))}
                </div>

                <div className="intel-story-panel">
                  {getEventBody(selectedEvent)}
                </div>

              </div>
            )}
          </article>

        </div>
      </section>

    </div>
  );
}

window.Timeline = Timeline;
