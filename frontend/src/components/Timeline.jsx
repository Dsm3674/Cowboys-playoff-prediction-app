function Timeline() {
  const canvasRef = React.useRef(null);

  const [events, setEvents] = React.useState([]);
  const [season, setSeason] = React.useState(new Date().getFullYear());
  const [timelineData, setTimelineData] = React.useState([]);
  const [inflectionPoints, setInflectionPoints] = React.useState([]);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [timelineReason, setTimelineReason] = React.useState("");

  const canvasWidth = 1000;
  const canvasHeight = 400;

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
          ? timelineResult.reason || "No timeline points available."
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
    drawTimeline({
      points: timelineData,
      inflections: inflectionPoints,
      events,
      reason: error || timelineReason,
      state: error ? "error" : timelineData.length ? "ready" : "empty",
    });
  }, [timelineData, inflectionPoints, events, error, timelineReason]);

  function clearCanvas(ctx) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "rgba(10, 15, 32, 0.98)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  function drawGrid(ctx, padding) {
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i += 1) {
      const y = padding + ((canvasHeight - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }
  }

  function drawAxes(ctx, padding) {
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();
  }

  function drawEmptyState(ctx, title, detail) {
    clearCanvas(ctx);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 12);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial";
    ctx.fillText(detail || "", canvasWidth / 2, canvasHeight / 2 + 18);
  }

  function formatShortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(5, 10);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function drawTimeline({ points, inflections, reason, state }) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (state === "error") {
      drawEmptyState(ctx, "Timeline unavailable", reason || "Something went wrong.");
      return;
    }

    if (!points || points.length === 0) {
      drawEmptyState(
        ctx,
        "No timeline data",
        reason || "No timeline points available for this season."
      );
      return;
    }

    clearCanvas(ctx);

    const padding = 60;
    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;

    drawGrid(ctx, padding);
    drawAxes(ctx, padding);

    const values = points.map((point) => Number(point.value || 0));
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);
    const range = Math.max(1, maxValue - minValue);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 5; i += 1) {
      const ratio = i / 4;
      const y = padding + chartHeight * ratio;
      const labelValue = maxValue - range * ratio;
      ctx.fillText(labelValue.toFixed(1), padding - 10, y);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

    points.forEach((point, index) => {
      const x = padding + stepX * index;
      const label = formatShortDate(point.date);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(label, x, canvasHeight - padding + 10);
    });

    const coords = points.map((point, index) => {
      const value = Number(point.value || 0);
      const x = padding + stepX * index;
      const y = padding + ((maxValue - value) / range) * chartHeight;
      return { x, y, value, point, index };
    });

    if (coords.length > 1) {
      const gradient = ctx.createLinearGradient(0, padding, 0, canvasHeight - padding);
      gradient.addColorStop(0, "rgba(96,165,250,0.95)");
      gradient.addColorStop(1, "rgba(37,99,235,0.75)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);

      for (let i = 1; i < coords.length; i += 1) {
        ctx.lineTo(coords[i].x, coords[i].y);
      }

      ctx.stroke();
    }

    coords.forEach((item) => {
      ctx.beginPath();
      ctx.fillStyle = "#f8fafc";
      ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#2563eb";
      ctx.arc(item.x, item.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    (inflections || []).forEach((inflection) => {
      const matchIndex = points.findIndex(
        (point) => String(point.date) === String(inflection.date)
      );

      if (matchIndex === -1) return;

      const value = Number(points[matchIndex].value || inflection.value || 0);
      const x = padding + stepX * matchIndex;
      const y = padding + ((maxValue - value) / range) * chartHeight;

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

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 18px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Season Timeline: ${season}`, padding, 18);
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

  function renderEventList() {
    if (loading) {
      return <div style={styles.cardText}>Loading events...</div>;
    }

    if (!events.length) {
      return <div style={styles.cardText}>No events found for this season.</div>;
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
          Select an event to see more details.
        </div>
      );
    }

    return (
      <div>
        <div style={styles.eventDetailTitle}>{getEventTitle(selectedEvent)}</div>
        <div style={styles.eventSub}>{formatShortDate(getEventDate(selectedEvent))}</div>
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

        <div style={styles.toolbar}>
          <label htmlFor="timeline-season" style={styles.cardText}>
            Season
          </label>
          <input
            id="timeline-season"
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value) || new Date().getFullYear())}
            style={styles.input}
          />
          <button type="button" onClick={loadData} style={styles.button}>
            Reload
          </button>
        </div>

        {timelineReason && !error ? (
          <div style={styles.notice}>{timelineReason}</div>
        ) : null}

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={styles.canvas}
          />
        </div>

        <div
          style={{
            ...styles.grid,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Events</h3>
            {renderEventList()}
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Event details</h3>
            {renderSelectedEvent()}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  input: {
    background: "rgba(15,23,42,0.9)",
    color: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "10px",
    padding: "10px 12px",
    width: "120px",
  },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  notice: {
    background: "rgba(37,99,235,0.08)",
    color: "#bfdbfe",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "14px",
  },
  error: {
    background: "rgba(127,29,29,0.22)",
    color: "#fecaca",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "14px",
  },
  canvasWrap: {
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "18px",
    overflowX: "auto",
  },
  canvas: {
    width: "100%",
    maxWidth: "1000px",
    borderRadius: "12px",
    display: "block",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
    marginBottom: "18px",
  },
  card: {
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "18px",
  },
  cardTitle: {
    marginTop: 0,
    color: "#f8fafc",
  },
  cardText: {
    color: "#94a3b8",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: "10px 0",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    cursor: "pointer",
  },
  eventSub: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    marginTop: "4px",
  },
  eventDetailTitle: {
    fontWeight: 800,
    color: "#f8fafc",
    fontSize: "1.05rem",
  },
  eventBody: {
    marginTop: "10px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
};

window.Timeline = Timeline;
