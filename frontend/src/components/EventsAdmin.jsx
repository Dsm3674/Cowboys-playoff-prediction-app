// frontend/src/components/EventsAdmin.jsx

const { useState, useEffect, useCallback, useRef } = React;

function EventsAdmin() {
  const [playerQuery, setPlayerQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [eventType, setEventType] = useState("injury");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [impactScore, setImpactScore] = useState(5);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const suggestionsRef = useRef(null);
  const debounceTimer = useRef(null);

  const eventTypeOptions = [
    "injury", "return", "trade", "signing", "performance_peak",
    "contract_extension", "coaching_change", "other"
  ];

  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch(
        `${window.BASE_URL}/api/players/search?name=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setSuggestions([]);
    }
  }, []);

  const handlePlayerInput = (value) => {
    setPlayerQuery(value);
    setSelectedPlayer(null);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    setPlayerQuery(player.player_name || player);
    setSuggestions([]);
  };

  const fetchRecentEvents = useCallback(async () => {
    try {
      const response = await fetch(
        `${window.BASE_URL}/api/players/events?season=${season}&limit=10`
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setEvents([]);
    }
  }, [season]);

  useEffect(() => { fetchRecentEvents(); }, [fetchRecentEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!selectedPlayer && !playerQuery) return setError("Please select a player");
    setLoading(true);

    try {
      const response = await fetch(`${window.BASE_URL}/api/players/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: selectedPlayer?.player_name || playerQuery,
          event_type: eventType,
          event_date: eventDate,
          description: description || null,
          impact_score: impactScore,
          season: parseInt(season),
        }),
      });

      if (!response.ok) throw new Error("Failed to create event");
      setSuccess("Event created successfully");
      setPlayerQuery("");
      setSelectedPlayer(null);
      setDescription("");
      fetchRecentEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="events-admin-page">
      <div className="events-admin-container">
        <h1>Events Admin</h1>
        <div className="admin-content">
          <div className="form-section">
            <h2>Create Event</h2>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Player Name *</label>
                <div className="search-input-wrapper" ref={suggestionsRef}>
                  <input
                    type="text"
                    value={playerQuery}
                    onChange={(e) => handlePlayerInput(e.target.value)}
                    className="form-input"
                    placeholder="Search player..."
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-dropdown">
                      {suggestions.map((p, idx) => (
                        <li key={idx} onClick={() => selectPlayer(p)} className="suggestion-item">
                          {p.player_name || p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Event Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-select">
                  {eventTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                 <label>Date</label>
                 <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                 <label>Impact (1-10): {impactScore}</label>
                 <input type="range" min="1" max="10" value={impactScore} onChange={(e) => setImpactScore(Number(e.target.value))} className="form-range" />
              </div>

              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? "Creating..." : "Create Event"}
              </button>
            </form>
          </div>
          
          <div className="events-list-section">
            <h2>Recent Events</h2>
            <ul className="events-list">
               {events.map((ev, i) => (
                 <li key={i} className="event-item">
                    <strong>{ev.player_name}</strong> - {ev.event_type} ({ev.impact_score})
                 </li>
               ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

window.EventsAdmin = EventsAdmin;
