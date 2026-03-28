function Timeline() {
  const canvasRef = React.useRef(null);

  const DEFAULT_SEASON = 2025;

  const [events, setEvents] = React.useState([]);
  const [season, setSeason] = React.useState(DEFAULT_SEASON);
  const [timelineData, setTimelineData] = React.useState([]);
  const [inflectionPoints, setInflectionPoints] = React.useState([]);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [timelineReason, setTimelineReason] = React.useState("");

  const canvasWidth = 1000;
  const canvasHeight = 400;

  const styles = {
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      marginBottom: "1.5rem",
      flexWrap: "wrap",
    },
    inputWrap: {
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    },
    input: {
      width: "160px",
      padding: "0.9rem 1rem",
      borderRadius: "14px",
      border: "1px solid rgba(148,163,184,0.35)",
      background: "#1e293b",
      color: "#f8fafc",
      fontSize: "1.1rem",
      fontWeight: 700,
      outline: "none",
    },
    button: {
      padding: "0.9rem 1.2rem",
      borderRadius: "14px",
      border: "none",
      background: "#2563eb",
      color: "#ffffff",
      fontWeight: 700,
      cursor: loading ? "not-allowed" : "pointer",
      opacity: loading ? 0.7 : 1,
    },
    cardText: {
      color: "#94a3b8",
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
    warningText: {
      color: "#fbbf24",
      fontSize: "0.9rem",
      marginTop: "0.75rem",
    },
    errorText: {
      color: "#fca5a5",
      fontSize: "0.95rem",
      marginTop: "0.75rem",
    },
    layout: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
      gap: "1.25rem",
      marginTop: "1.5rem",
    },
    subCard: {
      background: "rgba(15,23,42,0.75)",
      border: "1px solid rgba(148,163,184,0.15)",
      borderRadius: "18px",
      padding: "1rem",
    },
    list: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      maxHeight: "420px",
      overflowY: "auto",
    },
    listItem: {
      cursor: "pointer",
      borderBottom: "1px solid rgba(148,163,184,0.12)",
      paddingBottom: "0.75rem",
    },
    eventSub: {
      color: "#94a3b8",
      fontSize: "0.85rem",
      marginTop: "0.25rem",
    },
    eventDetailTitle: {
      color: "#f8fafc",
      fontWeight: 800,
      fontSize: "1.05rem",
      marginBottom: "0.4rem",
    },
    eventBody: {
      color: "#cbd5e1",
      lineHeight: 1.7,
      marginTop: "0.85rem",
      whiteSpace: "pre-wrap",
    },
    metaRow: {
      display: "flex",
      gap: "0.75rem",
      flexWrap: "wrap",
      marginTop: "0.75rem",
      marginBottom: "0.75rem",
    },
    chip: {
      background: "rgba(37,99,235,0.14)",
      color: "#bfdbfe",
      border: "1px solid rgba(96,165,250,0.22)",
      padding: "0.35rem 0.65rem",
      borderRadius: "999px",
      fontSize: "0.78rem",
      fontWeight: 700,
    },
  };

  const fetchEvents = React.useCallback(async () => {
    if (window.api && typeof window.api.getPlayerEvents === "function") {
      const data = await window.api.getPlayerEvents(season, 100);
      return Array.isArray(data.events) ? data.events : [];
    }

    const response = await fetch(
      `${window.BASE_URL || ""}/api/players/events?season=${season}&limit=100`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }

    const data = await response.json();
    return Array.isArray(data.events) ? data.events : [];
  }, [season]);

  const fetchTimeline = React.useCallback(async () => {
    if (window.api && typeof window.api.getTimelinePoints === "function") {
      const data = await window.api.getTimelinePoints(season);
      return {
        points: Array.isArray(data.points) ? data.points : [],
        inflectionPoints: Array.isArray(data.inflectionPoints)
          ? data.inflectionPoints
          : [],
        reason: data.reason || "",
        dataUnavailable: Boolean(data.dataUnavailable),
      };
    }

    const response = await fetch(
      `${window.BASE_URL || ""}/api/timeline/points?season=${season}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch timeline");
    }

    const data = await response.json();

    return {
      points: Array.isArray(data.points) ? data.points : [],
      inflectionPoints: Array.isArray(data.inflectionPoints)
        ? data.inflectionPoints
        : [],
      reason: data.reason || "",
      dataUnavailable: Boolean(data.dataUnavailable),
    };
  }, [season]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setTimelineReason("");
      setSelectedEvent(null);

      const [eventsResult, timelineResult] = await Promise.all([
        fetchEvents(),
        fetchTimeline(),
      ]);

      setEvents(eventsResult);
      setTimelineData(timelineResult.points);
      setInflectionPoints(timelineResult.inflectionPoints);
      setTimelineReason(
        timelineResult.dataUnavailable
          ? timelineResult.reason || "No real timeline points available."
          : ""
      );
    } catch (err) {
      console.error("Unable to load timeline data:", err);
      setError(err?.message || "Unable to load timeline data.");
      setEvents([]);
      setTimelineData([]);
      setInflectionPoints([]);
      setTimelineReason("");
      setSelectedEvent(null);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, fetchTimeline]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    drawTimeline();
  }, [timelineData, inflectionPoints, events, error, timelineReason, season]);

  function asNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function toDateMs(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function toDayKey(value) {
    const ms = toDateMs(value);
    if (ms === null) return "";
    return new Date(ms).toISOString().slice(0, 10);
  }

  function formatShortDate(value) {
    const ms = toDateMs(value);
    if (ms === null) return "Unknown date";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(ms));
  }

  function clearCanvas(ctx) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#020817";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  function drawEmptyState(ctx, title, subtitle) {
    clearCanvas(ctx);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 20);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Arial";
    ctx.fillText(subtitle, canvasWidth / 2, canvasHeight / 2 + 16);
  }

  function drawGrid(ctx, padding, minValue, maxValue, chartHeight) {
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i += 1) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const valueRange = Math.max(1, maxValue - minValue);

    for (let i = 0; i < 5; i += 1) {
      const ratio = i / 4;
      const y = padding + chartHeight * ratio;
      const value = maxValue - valueRange * ratio;
      ctx.fillText(value.toFixed(1), padding - 10, y);
    }
  }

  function drawAxes(ctx, padding) {
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();
  }

  function getEventTitle(event) {
    return (
      event.title ||
      event.event_title ||
      event.eventType ||
      event.event_type ||
      "Untitled event"
    );
  }

  function getEventDate(event) {
    return (
      event.date ||
      event.event_date ||
      event.created_at ||
      event.timestamp ||
      ""
    );
  }

  function getEventBody(event) {
    return (
      event.description ||
      event.details ||
      event.summary ||
      event.notes ||
      "No additional details available."
    );
  }

  function getEventImpact(event) {
    return (
      event.impact_score ??
      event.impact ??
      event.value ??
      null
    );
  }

  function normalizeTimelinePoints(points) {
    return (Array.isArray(points) ? points : [])
      .map((point, index) => ({
        ...point,
        _index: index,
        _dateMs: toDateMs(point.date),
        _value: asNumber(point.value, NaN),
      }))
      .filter((point) => point._dateMs !== null && Number.isFinite(point._value))
      .sort((a, b) => a._dateMs - b._dateMs);
  }

  function normalizeEvents(items) {
    return (Array.isArray(items) ? items : [])
      .map((event, index) => ({
        ...event,
        _index: index,
        _dateMs: toDateMs(getEventDate(event)),
        _dayKey: toDayKey(getEventDate(event)),
      }))
      .filter((event) => event._dateMs !== null)
      .sort((a, b) => a._dateMs - b._dateMs);
  }

  function normalizeInflections(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        ...item,
        _dayKey: toDayKey(item.date),
      }))
      .filter((item) => item._dayKey);
  }

  function drawTimeline() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (error) {
      drawEmptyState(ctx, "Timeline unavailable", error);
      return;
    }

    const points = normalizeTimelinePoints(timelineData);
    const realEvents = normalizeEvents(events);
    const realInflections = normalizeInflections(inflectionPoints);

    if (!points.length) {
      drawEmptyState(
        ctx,
        "No real timeline data",
        timelineReason || "No real timeline points available for this season."
      );
      return;
    }

    clearCanvas(ctx);

    const padding = 70;
    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;

    const values = points.map((p) => p._value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);

    const minTime = points[0]._dateMs;
    const maxTime = points[points.length - 1]._dateMs;

    const valueRange = Math.max(1, maxValue - minValue);
    const timeRange = Math.max(1, maxTime - minTime);

    const getX = (ms) => padding + ((ms - minTime) / timeRange) * chartWidth;
    const getY = (value) =>
      padding + ((maxValue - value) / valueRange) * chartHeight;

    drawGrid(ctx, padding, minValue, maxValue, chartHeight);
    drawAxes(ctx, padding);

    const coords = points.map((point) => ({
      point,
      x: getX(point._dateMs),
      y: getY(point._value),
    }));

    const lineGradient = ctx.createLinearGradient(0, padding, 0, canvasHeight - padding);
    lineGradient.addColorStop(0, "#60a5fa");
    lineGradient.addColorStop(1, "#2563eb");

    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);

    for (let i = 1; i < coords.length; i += 1) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.stroke();

    coords.forEach((item) => {
      ctx.beginPath();
      ctx.fillStyle = "#f8fafc";
      ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#3b82f6";
      ctx.arc(item.x, item.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const tickCount = Math.min(6, points.length);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i < tickCount; i += 1) {
      const ratio = tickCount === 1 ? 0 : i / (tickCount - 1);
      const tickTime = minTime + ratio * timeRange;
      const x = getX(tickTime);
      ctx.fillText(formatShortDate(tickTime), x, canvasHeight - padding + 10);
    }

    const pointByDay = new Map(points.map((point) => [toDayKey(point.date), point]));

    realInflections.forEach((inflection) => {
      const matchedPoint = pointByDay.get(inflection._dayKey);
      if (!matchedPoint) return;

      const x = getX(matchedPoint._dateMs);
      const y = getY(matchedPoint._value);

      ctx.beginPath();
      ctx.fillStyle = "#f59e0b";
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "#fff7ed";
      ctx.lineWidth = 2;
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(inflection.type || "inflection", x, y - 14);
    });

    const eventCountsByDay = new Map();
    realEvents.forEach((event) => {
      eventCountsByDay.set(
        event._dayKey,
        (eventCountsByDay.get(event._dayKey) || 0) + 1
      );
    });

    eventCountsByDay.forEach((count, dayKey) => {
      const matchedPoint = pointByDay.get(dayKey);
      if (!matchedPoint) return;

      const x = getX(matchedPoint._dateMs);
      const y = canvasHeight - padding + 18;

      ctx.beginPath();
      ctx.fillStyle = "#e2e8f0";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (count > 1) {
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(count), x, y + 8);
      }
    });

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 18px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Season Timeline: ${season}`, padding, 18);
  }

  function renderEventList() {
    if (loading) {
      return <div style={styles.cardText}>Loading real events...</div>;
    }

    if (!events.length) {
      return <div style={styles.cardText}>No real events found for this season.</div>;
    }

    return (
      <ul style={styles.list}>
        {events.map((event, index) => {
          const title = getEventTitle(event);
          const date = getEventDate(event);
          const isSelected =
            selectedEvent &&
            getEventTitle(selectedEvent) === title &&
            getEventDate(selectedEvent) === date;

          return (
            <li
              key={`${title}-${date}-${index}`}
              style={{
                ...styles.listItem,
                background: isSelected ? "rgba(37,99,235,0.12)" : "transparent",
                paddingLeft: isSelected ? "10px" : "0px",
                borderRadius: isSelected ? "10px" : "0px",
              }}
              onClick={() => setSelectedEvent(event)}
            >
              <div style={{ color: "#f8fafc", fontWeight: 700 }}>{title}</div>
              <div style={styles.eventSub}>{formatShortDate(date)}</div>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderSelectedEvent() {
    if (!selectedEvent) {
      return (
        <div style={styles.cardText}>
          Select a real event to see more details.
        </div>
      );
    }

    const impact = getEventImpact(selectedEvent);

    return (
      <div>
        <div style={styles.eventDetailTitle}>{getEventTitle(selectedEvent)}</div>
        <div style={styles.eventSub}>{formatShortDate(getEventDate(selectedEvent))}</div>

        <div style={styles.metaRow}>
          {selectedEvent.player_name ? (
            <span style={styles.chip}>{selectedEvent.player_name}</span>
          ) : null}
          {selectedEvent.event_type ? (
            <span style={styles.chip}>{selectedEvent.event_type}</span>
          ) : null}
          {impact !== null ? (
            <span style={styles.chip}>Impact: {impact}</span>
          ) : null}
        </div>

        <div style={styles.eventBody}>{getEventBody(selectedEvent)}</div>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="card">
        <h2 style={{ marginTop: 0, color: "#f8fafc" }}>Timeline</h2>
        <p style={styles.cardText}>
          Explore season momentum, key inflection points, and player-related events.
        </p>

        <div style={styles.controls}>
          <div style={styles.inputWrap}>
            <label style={{ color: "#cbd5e1", fontWeight: 700 }}>Season</label>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value) || DEFAULT_SEASON)}
              style={styles.input}
            />
          </div>

          <button style={styles.button} onClick={loadData} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>

        {timelineReason ? (
          <div style={styles.warningText}>{timelineReason}</div>
        ) : null}

        {error ? <div style={styles.errorText}>{error}</div> : null}

        <div style={{ marginTop: "1rem" }}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              width: "100%",
              maxWidth: `${canvasWidth}px`,
              background: "#020817",
              borderRadius: "18px",
              border: "1px solid rgba(148,163,184,0.18)",
              display: "block",
            }}
          />
        </div>

        <div style={styles.layout}>
          <div style={styles.subCard}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Events</h3>
            {renderEventList()}
          </div>

          <div style={styles.subCard}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Selected Event</h3>
            {renderSelectedEvent()}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Timeline = Timeline;
