function Timeline() {
  const canvasRef = React.useRef(null);
  const [events, setEvents] = React.useState([]);
  const [season, setSeason] = React.useState(new Date().getFullYear());
  const [timelineData, setTimelineData] = React.useState([]);
  const [inflectionPoints, setInflectionPoints] = React.useState([]);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const canvasWidth = 1000;
  const canvasHeight = 400;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${window.BASE_URL}/api/players/events?season=${season}&limit=100`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await fetch(
        `${window.BASE_URL}/api/timeline/points?season=${season}`
      );
      if (!response.ok) throw new Error("Failed to fetch timeline");
      const data = await response.json();
      setTimelineData(data.points || []);
      setInflectionPoints(data.inflectionPoints || []);
    } catch (err) {
      console.error("Error fetching timeline:", err);
      setTimelineData([]);
      setInflectionPoints([]);
    }
  };

  React.useEffect(() => {
    fetchEvents();
    fetchTimeline();
  }, [season]);

  React.useEffect(() => {
    if (canvasRef.current && timelineData.length > 0) {
      drawTimeline();
    }
  }, [timelineData, inflectionPoints, events]);

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const padding = 50;

    ctx.fillStyle = "rgba(20, 20, 40, 0.8)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
      const y = padding + ((canvasHeight - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();

    const values = timelineData.map((point) => Number(point.value || 0));
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);
    const chartHeight = canvasHeight - padding * 2;
    const chartWidth = canvasWidth - padding * 2;
    const range = Math.max(1, maxValue - minValue);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";

    for (let i = 0; i < 5; i++) {
      const value = maxValue - ((maxValue - minValue) / 4) * i;
      const y = padding + (chartHeight / 4) * i;
      ctx.fillText(value.toFixed(1), padding - 8, y + 4);
    }

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();

    timelineData.forEach((point, index) => {
      const x = padding + (index / Math.max(1, timelineData.length - 1)) * chartWidth;
      const y =
        padding +
        ((maxValue - Number(point.value || 0)) / range) * chartHeight;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    timelineData.forEach((point, index) => {
      const x = padding + (index / Math.max(1, timelineData.length - 1)) * chartWidth;
      const y =
        padding +
        ((maxValue - Number(point.value || 0)) / range) * chartHeight;

      ctx.beginPath();
      ctx.fillStyle = "#93c5fd";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    inflectionPoints.forEach((inflection) => {
      const pointIndex = timelineData.findIndex((point) => point.date === inflection.date);
      if (pointIndex === -1) return;

      const x = padding + (pointIndex / Math.max(1, timelineData.length - 1)) * chartWidth;
      const y =
        padding +
        ((maxValue - Number(timelineData[pointIndex].value || 0)) / range) * chartHeight;

      ctx.beginPath();
      ctx.fillStyle = inflection.type === "peak" ? "#22c55e" : "#f59e0b";
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Season Timeline ${season}`, 20, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText(`Points: ${timelineData.length} · Events: ${events.length}`, 20, 48);

    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    const step = Math.max(1, Math.floor(timelineData.length / 6));

    for (let i = 0; i < timelineData.length; i += step) {
      const x = padding + (i / Math.max(1, timelineData.length - 1)) * chartWidth;
      const label = String(timelineData[i].date || "").slice(5);
      ctx.fillText(label, x, canvasHeight - padding + 18);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1300px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#1e293b" }}>Timeline</h1>
          <p style={{ marginTop: "0.5rem", color: "#64748b" }}>
            Event timeline and inflection points for the selected season.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "end" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.4rem",
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "#334155",
              }}
            >
              Season
            </label>
            <input
              type="number"
              value={season}
              onChange={(e) =>
                setSeason(Number(e.target.value) || new Date().getFullYear())
              }
              style={{
                padding: "0.7rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                width: "120px",
              }}
            />
          </div>

          <button
            onClick={() => {
              fetchEvents();
              fetchTimeline();
            }}
            style={{
              padding: "0.8rem 1.2rem",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
            color: "#64748b",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          Loading timeline data...
        </div>
      ) : null}

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "1rem",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          overflowX: "auto",
          marginBottom: "1.5rem",
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "1000px",
            borderRadius: "8px",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1.25rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#1e293b" }}>Inflection Points</h2>

          {inflectionPoints.length === 0 ? (
            <div style={{ color: "#64748b" }}>No inflection points available.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {inflectionPoints.slice(0, 12).map((point, idx) => (
                <li
                  key={`${point.date}-${idx}`}
                  style={{
                    padding: "0.8rem 0",
                    borderBottom: "1px solid #f1f5f9",
                    color: "#334155",
                  }}
                >
                  <strong>{point.date}</strong> · {point.type} · {point.mode || "daily"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1.25rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#1e293b" }}>Recent Events</h2>

          {events.length === 0 ? (
            <div style={{ color: "#64748b" }}>No events returned.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {events.slice(0, 12).map((event, idx) => (
                <li
                  key={event.id || idx}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    padding: "0.8rem 0",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <div style={{ fontWeight: "700" }}>
                    {event.title || event.event_type || "Event"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                    {event.event_date || event.date || "Unknown date"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          padding: "1.25rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginTop: "1.5rem",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#1e293b" }}>Selected Event</h2>

        {!selectedEvent ? (
          <div style={{ color: "#64748b" }}>Select an event to inspect details.</div>
        ) : (
          <div>
            <div style={{ fontWeight: "700", fontSize: "1.05rem", color: "#0f172a" }}>
              {selectedEvent.title || selectedEvent.event_type || "Event"}
            </div>
            <div style={{ color: "#64748b", marginTop: "0.35rem" }}>
              {selectedEvent.event_date || selectedEvent.date || "Unknown date"}
            </div>
            <div style={{ color: "#334155", marginTop: "0.9rem", lineHeight: 1.6 }}>
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

window.Timeline = Timeline;
