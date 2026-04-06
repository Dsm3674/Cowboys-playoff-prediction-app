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

  const styles = {
    cardText: {
      color: "#000000",
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
    list: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      maxHeight: "320px",
      overflowY: "auto",
    },
    listItem: {
      cursor: "pointer",
      borderBottom: "1px solid rgba(148,163,184,0.12)",
      paddingBottom: "0.75rem",
    },
    eventSub: {
      color: "#000000",
      fontSize: "0.85rem",
      marginTop: "0.25rem",
    },
    eventDetailTitle: {
      color: "#000000",
      fontWeight: 800,
      fontSize: "1.05rem",
      marginBottom: "0.4rem",
    },
    eventBody: {
      color: "#000000",
      lineHeight: 1.7,
      marginTop: "0.85rem",
      whiteSpace: "pre-wrap",
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

      const results = await Promise.all([fetchEvents(), fetchTimeline()]);
      const eventsResult = results[0];
      const timelineResult = results[1];

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
      setError(err && err.message ? err.message : "Unable to load timeline data.");
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
    if (ms === null) return "Unknown";
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
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 18);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Arial";
    ctx.fillText(subtitle, canvasWidth / 2, canvasHeight / 2 + 16);
  }

  function drawGrid(ctx, padding, chartHeight) {
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i += 1) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
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

  function normalizePoints(points) {
    return (Array.isArray(points) ? points : [])
      .map(function (point, index) {
        const value = Number(point.value);
        const ms = toDateMs(point.date);

        return {
          raw: point,
          index: index,
          value: Number.isFinite(value) ? value : 0,
          date: point.date,
          ms: ms,
        };
      })
      .filter(function (point) {
        return point.ms !== null;
      })
      .sort(function (a, b) {
        return a.ms - b.ms;
      });
  }

  function normalizeEvents(items) {
    return (Array.isArray(items) ? items : [])
      .map(function (event) {
        const date = getEventDate(event);
        const ms = toDateMs(date);

        return {
          raw: event,
          date: date,
          ms: ms,
          dayKey: toDayKey(date),
        };
      })
      .filter(function (event) {
        return event.ms !== null;
      })
      .sort(function (a, b) {
        return a.ms - b.ms;
      });
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

    const points = normalizePoints(timelineData);
    const normalizedEvents = normalizeEvents(events);

    if (!points.length) {
      drawEmptyState(
        ctx,
        "No real timeline data",
        timelineReason || "No timeline points available for this season."
      );
      return;
    }

    clearCanvas(ctx);

    const padding = 70;
    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;

    const values = points.map(function (point) {
      return point.value;
    });

    const minValue = Math.min.apply(null, values.concat([0]));
    const maxValue = Math.max.apply(null, values.concat([0]));
    const valueRange = Math.max(1, maxValue - minValue);

    const minTime = points[0].ms;
    const maxTime = points[points.length - 1].ms;
    const timeRange = Math.max(1, maxTime - minTime);

    function getX(ms) {
      return padding + ((ms - minTime) / timeRange) * chartWidth;
    }

    function getY(value) {
      return padding + ((maxValue - value) / valueRange) * chartHeight;
    }

    drawGrid(ctx, padding, chartHeight);
    drawAxes(ctx, padding);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 5; i += 1) {
      const ratio = i / 4;
      const y = padding + chartHeight * ratio;
      const labelValue = maxValue - valueRange * ratio;
      ctx.fillText(labelValue.toFixed(1), padding - 10, y);
    }

    const coords = points.map(function (point) {
      return {
        point: point,
        x: getX(point.ms),
        y: getY(point.value),
      };
    });

    const gradient = ctx.createLinearGradient(0, padding, 0, canvasHeight - padding);
    gradient.addColorStop(0, "#60a5fa");
    gradient.addColorStop(1, "#2563eb");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);

    for (let i = 1; i < coords.length; i += 1) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }

    ctx.stroke();

    for (let i = 0; i < coords.length; i += 1) {
      ctx.beginPath();
      ctx.fillStyle = "#f8fafc";
      ctx.arc(coords[i].x, coords[i].y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#3b82f6";
      ctx.arc(coords[i].x, coords[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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

    const pointByDay = new Map();
    for (let i = 0; i < points.length; i += 1) {
      pointByDay.set(toDayKey(points[i].date), points[i]);
    }

    for (let i = 0; i < inflectionPoints.length; i += 1) {
      const inflection = inflectionPoints[i];
      const matchedPoint = pointByDay.get(toDayKey(inflection.date));
      if (!matchedPoint) continue;

      const x = getX(matchedPoint.ms);
      const y = getY(matchedPoint.value);

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
    }

    const eventCountsByDay = new Map();
    for (let i = 0; i < normalizedEvents.length; i += 1) {
      const key = normalizedEvents[i].dayKey;
      eventCountsByDay.set(key, (eventCountsByDay.get(key) || 0) + 1);
    }

    eventCountsByDay.forEach(function (count, dayKey) {
      const matchedPoint = pointByDay.get(dayKey);
      if (!matchedPoint) return;

      const x = getX(matchedPoint.ms);
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
    ctx.fillText("Season Timeline: " + season, padding, 18);
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
        {events.map(function (event, index) {
          const title = getEventTitle(event);
          const date = getEventDate(event);
          const isSelected =
            selectedEvent &&
            getEventTitle(selectedEvent) === title &&
            getEventDate(selectedEvent) === date;

          return (
            <li
              key={title + "-" + date + "-" + index}
              style={{
                ...styles.listItem,
                background: isSelected ? "rgba(37,99,235,0.12)" : "transparent",
                paddingLeft: isSelected ? "10px" : "0px",
                borderRadius: isSelected ? "10px" : "0px",
              }}
              onClick={function () {
                setSelectedEvent(event);
              }}
            >
              <div style={{ color: "#000000", fontWeight: 700 }}>{title}</div>
              <div style={styles.eventSub}>{formatShortDate(date)}</div>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderSelectedEvent() {
    if (!selectedEvent) {
      return <div style={styles.cardText}>Select an event to see more details.</div>;
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
        <h2 style={{ marginTop: 0, color: "#000000" }}>Timeline</h2>
        <p style={styles.cardText}>
          Explore season momentum, key inflection points, and player-related events.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <label style={{ color: "#000000", fontWeight: 700 }}>Season</label>
          <input
            type="number"
            value={season}
            onChange={function (e) {
              const nextSeason = Number(e.target.value);
              setSeason(Number.isFinite(nextSeason) && nextSeason > 0 ? nextSeason : 2025);
            }}
            style={{
              width: "160px",
              padding: "0.9rem 1rem",
              borderRadius: "14px",
              border: "1px solid rgba(148,163,184,0.35)",
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: "1.1rem",
              fontWeight: 700,
              outline: "none",
            }}
          />
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: "0.9rem 1.2rem",
              borderRadius: "14px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>

        {timelineReason ? (
          <div style={{ color: "#fbbf24", marginBottom: "0.75rem" }}>{timelineReason}</div>
        ) : null}

        {error ? (
          <div style={{ color: "#fca5a5", marginBottom: "0.75rem" }}>{error}</div>
        ) : null}

        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            width: "100%",
            maxWidth: canvasWidth + "px",
            background: "#020817",
            borderRadius: "18px",
            border: "1px solid rgba(148,163,184,0.18)",
            display: "block",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0, color: "#000000" }}>Events</h3>
            {renderEventList()}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0, color: "#000000" }}>Selected Event</h3>
            {renderSelectedEvent()}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Timeline = Timeline;
