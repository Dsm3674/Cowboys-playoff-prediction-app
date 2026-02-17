// frontend/src/components/Timeline.jsx

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

  // Fetch player events
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

  // Fetch timeline data with inflection points
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
    
    // Clear canvas
    ctx.fillStyle = "rgba(20, 20, 40, 0.8)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw border
    ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvasWidth - 40, canvasHeight - 40);

    if (timelineData.length === 0) {
      ctx.fillStyle = "#909090";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("No timeline data available", canvasWidth / 2, canvasHeight / 2);
      return;
    }

    // Find min/max values
    const values = timelineData.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = "rgba(0, 212, 255, 0.1)";
    ctx.lineWidth = 1;
    const graphHeight = canvasHeight - 2 * padding;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - (valueRange / 4) * i;
      ctx.fillStyle = "#909090";
      ctx.font = "12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(value.toFixed(1), padding - 10, y + 4);
    }

    const graphWidth = canvasWidth - 2 * padding;

    // Draw X-axis labels (dates)
    ctx.fillStyle = "#909090";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    for (let i = 0; i < timelineData.length; i += Math.max(1, Math.floor(timelineData.length / 5))) {
      const x = padding + (graphWidth / (timelineData.length - 1)) * i;
      const date = new Date(timelineData[i].date);
      ctx.fillText(date.toLocaleDateString(), x, canvasHeight - 15);
    }

    // Draw main timeline line
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < timelineData.length; i++) {
      const x = padding + (graphWidth / (timelineData.length - 1)) * i;
      const y = canvasHeight - padding - ((timelineData[i].value - minValue) / valueRange) * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw main data points
    ctx.fillStyle = "#00d4ff";
    for (let i = 0; i < timelineData.length; i++) {
      const x = padding + (graphWidth / (timelineData.length - 1)) * i;
      const y = canvasHeight - padding - ((timelineData[i].value - minValue) / valueRange) * graphHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw inflection points
    inflectionPoints.forEach((point) => {
      const idx = timelineData.findIndex((p) => p.date === point.date);
      if (idx !== -1) {
        const x = padding + (graphWidth / (timelineData.length - 1)) * idx;
        const y = canvasHeight - padding - ((timelineData[idx].value - minValue) / valueRange) * graphHeight;

        // Draw inflection indicator
        ctx.strokeStyle = point.type === "peak" ? "#ff4444" : "#44ff44";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = point.type === "peak" ? "#ff8888" : "#88ff88";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        const labelY = point.type === "peak" ? y - 25 : y + 20;
        ctx.fillText(point.type.toUpperCase(), x, labelY);
      }
    });

    // Draw event markers
    events.forEach((event) => {
      const eventIdx = timelineData.findIndex(
        (p) => p.date.split("T")[0] === event.event_date.split("T")[0]
      );
      if (eventIdx !== -1) {
        const x = padding + (graphWidth / (timelineData.length - 1)) * eventIdx;
        const y = canvasHeight - padding - ((timelineData[eventIdx].value - minValue) / valueRange) * graphHeight;

        // Draw event marker (diamond)
        const size = 8;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  return (
    <div className="timeline-page">
      <div className="timeline-container">
        <h1>Cowboys Timeline Analytics</h1>
        <p className="subtitle">Season performance with inflection points and events</p>

        <div className="timeline-controls">
          <div className="control-group">
            <label htmlFor="season">Season:</label>
            <select
              id="season"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="season-select"
            >
              {[2020, 2021, 2022, 2023, 2024, 2025].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="loading">Loading...</div>}
        </div>

        <div className="timeline-content">
          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="timeline-canvas"
            />
          </div>

          <div className="legend">
            <h3>Legend</h3>
            <div className="legend-item">
              <div className="legend-color cyan"></div>
              <span>Timeline</span>
            </div>
            <div className="legend-item">
              <div className="legend-color gold"></div>
              <span>Player Events</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker peak"></div>
              <span>Peak (Local Max)</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker valley"></div>
              <span>Valley (Local Min)</span>
            </div>
          </div>
        </div>

        <div className="inflection-details">
          <h2>Inflection Points</h2>
          {inflectionPoints.length === 0 ? (
            <p className="no-data">No inflection points detected</p>
          ) : (
            <ul className="inflection-list">
              {inflectionPoints.map((point, idx) => (
                <li key={idx} className={`inflection-item ${point.type}`}>
                  <div className="inflection-type">{point.type.toUpperCase()}</div>
                  <div className="inflection-date">{new Date(point.date).toLocaleDateString()}</div>
                  {point.description && (
                    <div className="inflection-description">{point.description}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="events-timeline">
          <h2>Events ({events.length})</h2>
          {events.length === 0 ? (
            <p className="no-data">No events recorded</p>
          ) : (
            <div className="events-list">
              {events.map((event, idx) => (
                <div
                  key={idx}
                  className={`event-card ${selectedEvent === idx ? "selected" : ""}`}
                  onClick={() => setSelectedEvent(selectedEvent === idx ? null : idx)}
                >
                  <div className="event-card-header">
                    <span className="event-card-player">{event.player_name}</span>
                    <span className="event-card-type">{event.event_type}</span>
                  </div>
                  <div className="event-card-date">
                    {new Date(event.event_date).toLocaleDateString()}
                  </div>
                  <div className={`event-card-impact impact-${Math.ceil(event.impact_score / 2)}`}>
                    Impact: {event.impact_score}/10
                  </div>
                  {event.description && selectedEvent === idx && (
                    <div className="event-card-description">{event.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.Timeline = Timeline;
