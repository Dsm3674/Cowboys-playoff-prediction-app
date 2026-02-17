// frontend/src/components/EventsAdmin.jsx

function EventsAdmin() {
  const [playerQuery, setPlayerQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);
  const [eventType, setEventType] = React.useState("injury");
  const [eventDate, setEventDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = React.useState("");
  const [impactScore, setImpactScore] = React.useState(5);
  const [season, setSeason] = React.useState(new Date().getFullYear());
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const suggestionsRef = React.useRef(null);
  const debounceTimer = React.useRef(null);

  const eventTypeOptions = [
    "injury",
    "return",
    "trade",
    "signing",
    "performance_peak",
    "contract_extension",
    "coaching_change",
    "other",
  ];

  // Fetch player suggestions with debounce
  const fetchSuggestions = React.useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${window.BASE_URL}/api/players/search?name=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestions([]);
    }
  }, []);

  const handlePlayerInput = (value) => {
    setPlayerQuery(value);
    setSelectedPlayer(null);

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    setPlayerQuery(player.player_name || player);
    setSuggestions([]);
  };

  // Fetch recent events
  const fetchRecentEvents = React.useCallback(async () => {
    try {
      const response = await fetch(
        `${window.BASE_URL}/api/players/events?season=${season}&limit=10`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    }
  }, [season]);

  // Load events on mount and when season changes
  React.useEffect(() => {
    fetchRecentEvents();
  }, [fetchRecentEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedPlayer && !playerQuery) {
      setError("Please select a player");
      return;
    }

    if (!eventDate) {
      setError("Please select an event date");
      return;
    }

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

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create event");
      }

      const createdEvent = await response.json();
      setSuccess(`Event created successfully for ${createdEvent.player_name}`);

      // Reset form
      setPlayerQuery("");
      setSelectedPlayer(null);
      setEventType("injury");
      setEventDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setImpactScore(5);

      // Refresh events list
      fetchRecentEvents();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
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
        <p className="subtitle">Create and manage Cowboys player events</p>

        <div className="admin-content">
          {/* Form Section */}
          <div className="form-section">
            <h2>Create Event</h2>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} className="event-form">
              {/* Player Selection */}
              <div className="form-group">
                <label htmlFor="player">Player Name *</label>
                <div className="search-input-wrapper" ref={suggestionsRef}>
                  <input
                    id="player"
                    type="text"
                    value={playerQuery}
                    onChange={(e) => handlePlayerInput(e.target.value)}
                    placeholder="Search player (min 2 characters)..."
                    className={`search-input ${selectedPlayer ? "selected" : ""}`}
                    autoComplete="off"
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-dropdown">
                      {suggestions.map((player, idx) => (
                        <li
                          key={idx}
                          onClick={() => selectPlayer(player)}
                          className="suggestion-item"
                        >
                          <div className="player-name">
                            {typeof player === "string" ? player : player.player_name}
                          </div>
                          {player.position && (
                            <div className="player-position">{player.position}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedPlayer && (
                  <div className="selected-player-badge">
                    ✓ {selectedPlayer.player_name || selectedPlayer}
                  </div>
                )}
              </div>

              {/* Event Type */}
              <div className="form-group">
                <label htmlFor="eventType">Event Type *</label>
                <select
                  id="eventType"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="form-select"
                >
                  {eventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Date */}
              <div className="form-group">
                <label htmlFor="eventDate">Event Date *</label>
                <input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Season */}
              <div className="form-group">
                <label htmlFor="season">Season</label>
                <input
                  id="season"
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  min={2000}
                  max={2100}
                  className="form-input"
                />
              </div>

              {/* Impact Score */}
              <div className="form-group">
                <label htmlFor="impact">
                  Impact Score: <span className="impact-value">{impactScore}</span>
                </label>
                <input
                  id="impact"
                  type="range"
                  min="1"
                  max="10"
                  value={impactScore}
                  onChange={(e) => setImpactScore(Number(e.target.value))}
                  className="form-range"
                />
                <div className="range-labels">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional: Add details about this event..."
                  className="form-textarea"
                  rows={4}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedPlayer}
                className="submit-button"
              >
                {loading ? "Creating..." : "Create Event"}
              </button>
            </form>
          </div>

          {/* Recent Events Section */}
          <div className="events-list-section">
            <h2>Recent Events (Season {season})</h2>
            {events.length === 0 ? (
              <p className="no-events">No events recorded yet</p>
            ) : (
              <ul className="events-list">
                {events.map((event) => (
                  <li key={`${event.player_name}-${event.event_date}`} className="event-item">
                    <div className="event-header">
                      <div className="event-player">{event.player_name}</div>
                      <div className="event-type">{event.event_type.replace(/_/g, " ")}</div>
                      <div className={`impact-badge impact-${Math.ceil(event.impact_score / 2)}`}>
                        {event.impact_score}/10
                      </div>
                    </div>
                    <div className="event-date">
                      {new Date(event.event_date).toLocaleDateString()}
                    </div>
                    {event.description && (
                      <div className="event-description">{event.description}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.EventsAdmin = EventsAdmin;
