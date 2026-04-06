// frontend/src/components/EventsAdmin.jsx

const { useState, useEffect, useCallback, useRef, useMemo } = React;

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
        `${window.BASE_URL}/api/players/events?season=${season}&limit=20`
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

  // Derived Stats
  const stats = useMemo(() => {
     return {
        total: events.length,
        highImpact: events.filter(e => e.impact_score >= 8).length,
        lastAdded: events[0]?.player_name || "N/A"
     };
  }, [events]);

  return (
    <div className="events-admin-page">
      <div className="events-admin-container">
        {/* PAGE HEADER */}
        <header className="events-admin-header">
          <div className="header-text">
            <h1>Events Intelligence Admin</h1>
            <p>Inject real-time player data, injuries, and performance shifts into the simulation engine.</p>
          </div>
        </header>

        {/* STATS ROW */}
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Recent Submissions</div>
            <div className="admin-stat-value">{stats.total}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">High Impact (8+)</div>
            <div className="admin-stat-value">{stats.highImpact}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Last Player Logged</div>
            <div className="admin-stat-value" style={{fontSize: '1.2rem', marginTop: '0.5rem'}}>{stats.lastAdded}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">System Mode</div>
            <div className="admin-stat-value">ACTIVE</div>
          </div>
        </div>

        <div className="admin-content-grid">
          {/* FORM SECTION */}
          <div className="admin-form-panel reveal-up stagger-1">
            <h3>Create New Event</h3>
            {error && <div className="alert alert-error" style={{marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem'}}>{error}</div>}
            {success && <div className="alert alert-success" style={{marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px', background: '#f0fdf4', color: '#15803d', fontSize: '0.85rem'}}>{success}</div>}
            
            <form onSubmit={handleSubmit} className="admin-form-grid">
              <div className="admin-form-field">
                <label>Player Name *</label>
                <div className="search-input-wrapper" style={{position: 'relative'}} ref={suggestionsRef}>
                  <input
                    type="text"
                    value={playerQuery}
                    onChange={(e) => handlePlayerInput(e.target.value)}
                    className="form-input"
                    placeholder="Search player..."
                    style={{width: '100%'}}
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-dropdown" style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, 
                      zIndex: 100, background: '#fff', border: '1px solid #D0D5DD', 
                      borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      maxHeight: '200px', overflowY: 'auto'
                    }}>
                      {suggestions.map((p, idx) => (
                        <li key={idx} onClick={() => selectPlayer(p)} className="suggestion-item">
                          {p.player_name || p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="admin-form-field">
                <label>Event Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-select">
                  {eventTypeOptions.map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
                </select>
              </div>

              <div className="admin-form-field">
                 <label>Event Date</label>
                 <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="form-input" />
              </div>

              <div className="admin-form-field">
                 <label style={{display: 'flex', justifyContent: 'space-between'}}>
                    Impact Score <span>{impactScore}/10</span>
                 </label>
                 <input type="range" min="1" max="10" value={impactScore} onChange={(e) => setImpactScore(Number(e.target.value))} className="form-range" style={{cursor: 'pointer'}} />
              </div>

              <div className="admin-form-actions">
                <button 
                  type="submit" 
                  className={`btn-primary ${loading ? 'btn-shimmer' : ''}`} 
                  disabled={loading} 
                  style={{width: '100%', position: 'relative', overflow: 'hidden'}}
                >
                  {loading ? "Injecting Data..." : "Injest Event"}
                </button>
              </div>
            </form>
          </div>
          
          {/* RECENT EVENTS LIST */}
          <div className="admin-table-panel reveal-up stagger-2">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                       <td colSpan="4" style={{textAlign: 'center', padding: '3rem', color: '#6B7280'}}>
                          No recent events found.
                       </td>
                    </tr>
                  ) : (
                    events.map((ev, i) => (
                      <tr 
                        key={i} 
                        className="reveal-up" 
                        style={{animationDelay: `${i * 50}ms`}}
                      >
                        <td style={{fontWeight: '600'}}>{ev.player_name}</td>
                        <td>
                          <span className={`event-type-badge ${ev.event_type}`}>
                            {ev.event_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{new Date(ev.event_date).toLocaleDateString()}</td>
                        <td>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span className={`impact-dot ${ev.impact_score >= 8 ? 'critical' : ev.impact_score >= 5 ? 'medium' : 'low'}`}></span>
                            {ev.impact_score}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.EventsAdmin = EventsAdmin;
