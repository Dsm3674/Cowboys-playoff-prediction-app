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
    const data = await window.api.getPlayerEvents(season, 100);
    return Array.isArray(data.events) ? data.events : [];
  }, [season]);

  const fetchTimeline = React.useCallback(async () => {
    const data = await window.api.getTimelinePoints(season);
    return {
      points: Array.isArray(data.points) ? data.points : [],
      inflectionPoints: Array.isArray(data.inflectionPoints) ? data.inflectionPoints : [],
      reason: data.reason || "",
      dataUnavailable: Boolean(data.dataUnavailable)
    };
  }, [season]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [eventsResult, timelineResult] = await Promise.all([
        fetchEvents(),
        fetchTimeline()
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
      setError(err.message || "Unable to load timeline data.");
      setEvents([]);
      setTimelineData([]);
      setInflectionPoints([]);
      setTimelineReason("");
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
      state: error ? "error" : timelineData.length ? "ready" : "empty"
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

  function drawEmptyState(ctx, title, detail) {
    clearCanvas(ctx);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 10);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Arial";
    ctx.fillText(detail, canvasWidth / 2, canvasHeight / 2 + 24);
  }

  function drawAxes(ctx, padding, minValue, maxValue) {
    ctx.strokeStyle = "rgba(226,232,240,0.4)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";

    for (let i = 0; i < 5; i += 1) {
      const value = maxValue - ((maxValue - minValue) / 4) * i;
      const y = padding + ((canvasHeight - padding * 2) / 4) * i;
      ctx.fillText(value.toFixed(1), padding - 8, y + 4);
    }
  }

  function drawLine(ctx, points, padding, minValue, maxValue) {
    if (!points.length) return;

    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;
    const range = Math.max(1, maxValue - minValue);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();

    points.forEach((point, index) => {
      const x = padding + (index / Math.max(1, points.length - 1)) * chartWidth;
      const y =
        padding + ((maxValue - Number(point.value || 0)) / range) * chartHeight;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    points.forEach((point, index) => {
      const x = padding + (index / Math.max(1, points.length - 1)) * chartWidth;
      const y =
        padding + ((maxValue - Number(point.value || 0)) / range) * chartHeight;

      ctx.beginPath();
      ctx.fillStyle = "#93c5fd";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLabels(ctx, points, padding) {
    if (!points.length) return;

    const chartWidth = canvasWidth - padding * 2;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";

    const step = Math.max(1, Math.floor(points.length / 6));

    for (let i = 0; i < points.length; i += step) {
      const x = padding + (i / Math.max(1, points.length - 1)) * chartWidth;
      const date = String(points[i].date || "");
      ctx.fillText(date.slice(5), x, canvasHeight - padding + 20);
    }
  }

  function drawInflections(ctx, points, inflections, padding, minValue, maxValue) {
    if (!points.length || !inflections.length) return;

    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;
    const range = Math.max(1, maxValue - minValue);

    inflections.forEach((item) => {
      const pointIndex = points.findIndex((p) => p.date === item.date);
      if (pointIndex < 0) return;

      const x = padding + (pointIndex / Math.max(1, points.length - 1)) * chartWidth;
      const y = padding + ((maxValue - Number(points[pointIndex].value || 0)) / range) * chartHeight;

      ctx.beginPath();
      ctx.fillStyle = item.type === "peak" ? "#22c55e" : "#f59e0b";
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawHeader(ctx, points) {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Timeline View · ${season}`, 24, 30);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial";
    ctx.fillText(`Points: ${points.length} · Events: ${events.length}`, 24, 54);
  }

  function drawTimeline({ points, inflections, reason, state }) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const padding = 60;

    if (state === "error") {
      drawEmptyState(ctx, "Timeline unavailable", reason || "A request failed.");
      return;
    }

    if (!points.length) {
      drawEmptyState(
        ctx,
        "No timeline data",
        reason || "No real timeline points were returned for this season."
      );
      return;
    }

    clearCanvas(ctx);
    drawHeader(ctx, points);
    drawGrid(ctx, padding);

    const values = points.map((p) => Number(p.value || 0));
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);

    drawAxes(ctx, padding, minValue, maxValue);
    drawLine(ctx, points, padding, minValue, maxValue);
    drawInflections(ctx, points, inflections, padding, minValue, maxValue);
    drawLabels(ctx, points, padding);
  }

  const eventRows = events.slice(0, 12);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Timeline</h1>
          <p style={styles.subtitle}>
            Canvas now clears and repaints on empty, error, and loaded states.
          </p>
        </div>

        <div style={styles.controls}>
          <label style={styles.label}>
            Season
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value) || new Date().getFullYear())}
              style={styles.input}
            />
          </label>

          <button style={styles.button} onClick={loadData}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <div style={styles.notice}>Loading timeline data…</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}
      {!error && timelineReason ? <div style={styles.notice}>{timelineReason}</div> : null}

      <div style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={styles.canvas}
        />
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Inflection Points</h3>
          {!inflectionPoints.length ? (
            <p style={styles.cardText}>No inflection points available.</p>
          ) : (
            <ul style={styles.list}>
              {inflectionPoints.slice(0, 10).map((point, index) => (
                <li key={`${point.date}-${index}`} style={styles.listItem}>
                  <strong>{point.date}</strong> · {point.type} · {point.mode || "daily"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Recent Events</h3>
          {!eventRows.length ? (
            <p style={styles.cardText}>No events returned.</p>
          ) : (
            <ul style={styles.list}>
              {eventRows.map((event, index) => (
                <li
                  key={event.id || index}
                  style={styles.listItem}
                  onClick={() => setSelectedEvent(event)}
                >
                  <strong>{event.title || event.event_type || "Event"}</strong>
                  <div style={styles.eventSub}>
                    {event.event_date || event.date || "Unknown date"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Selected Event</h3>
        {!selectedEvent ? (
          <p style={styles.cardText}>Select an event to inspect its detail.</p>
        ) : (
          <div>
            <div style={styles.eventDetailTitle}>
              {selectedEvent.title || selectedEvent.event_type || "Event"}
            </div>
            <div style={styles.eventSub}>
              {selectedEvent.event_date || selectedEvent.date || "Unknown date"}
            </div>
            <div style={styles.eventBody}>
              {selectedEvent.detail ||
                selectedEvent.description ||
                selectedEvent.message ||
                "No additional detail available."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "1280px",
    margin: "0 auto",
    color: "#e5e7eb"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px"
  },
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "2rem"
  },
  subtitle: {
    marginTop: "8px",
    color: "#94a3b8"
  },
  controls: {
    display: "flex",
    gap: "12px",
    alignItems: "end"
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#cbd5e1",
    fontSize: "0.9rem"
  },
  input: {
    background: "#0f172a",
    color: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "10px",
    padding: "10px 12px",
    width: "120px"
  },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700
  },
  notice: {
    background: "rgba(37,99,235,0.08)",
    color: "#bfdbfe",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "14px"
  },
  error: {
    background: "rgba(127,29,29,0.22)",
    color: "#fecaca",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "14px"
  },
  canvasWrap: {
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "18px",
    overflowX: "auto"
  },
  canvas: {
    width: "100%",
    maxWidth: "1000px",
    borderRadius: "12px",
    display: "block"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
    marginBottom: "18px"
  },
  card: {
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "18px"
  },
  cardTitle: {
    marginTop: 0,
    color: "#f8fafc"
  },
  cardText: {
    color: "#94a3b8"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0
  },
  listItem: {
    padding: "10px 0",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    cursor: "pointer"
  },
  eventSub: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    marginTop: "4px"
  },
  eventDetailTitle: {
    fontWeight: 800,
    color: "#f8fafc",
    fontSize: "1.05rem"
  },
  eventBody: {
    marginTop: "10px",
    color: "#cbd5e1",
    lineHeight: 1.6
  }
};

window.Timeline = Timeline;
