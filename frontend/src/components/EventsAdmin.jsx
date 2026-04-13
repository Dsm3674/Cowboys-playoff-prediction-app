const { useState, useEffect, useCallback, useRef, useMemo } = React;

function EventsAdmin() {
  const [playerQuery, setPlayerQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [eventType, setEventType] = useState("injury");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [impactScore, setImpactScore] = useState(5);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const debounceTimer = useRef(null);

  const eventTypeOptions = [
    "injury", "return", "trade", "signing",
    "performance_peak", "contract_extension",
    "coaching_change", "other"
  ];

  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 2) return setSuggestions([]);

    try {
      const res = await fetch(`${window.BASE_URL}/api/players/search?name=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handlePlayerInput = (value) => {
    setPlayerQuery(value);
    setSelectedPlayer(null);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const fetchRecentEvents = useCallback(async () => {
    try {
      const res = await fetch(`${window.BASE_URL}/api/players/events?season=${season}&limit=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    }
  }, [season]);

  useEffect(() => { fetchRecentEvents(); }, [fetchRecentEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!selectedPlayer && !playerQuery) {
      return setError("Select a player first.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${window.BASE_URL}/api/players/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: selectedPlayer?.player_name || playerQuery,
          event_type: eventType,
          event_date: eventDate,
          impact_score: impactScore,
          season: parseInt(season),
        }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      setSuccess("Event injected into simulation engine.");
      setPlayerQuery("");
      setSelectedPlayer(null);
      fetchRecentEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: events.length,
    highImpact: events.filter(e => e.impact_score >= 8).length,
    last: events[0]?.player_name || "--"
  }), [events]);

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">System Control</div>
          <h1 className="intel-title">Simulation Event Console</h1>
          <p className="intel-subtitle">
            Inject real-world player events into the simulation engine and observe downstream effects across projections.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Live Data Injection</div>
          <div className="intel-chip intel-chip--success">ACTIVE</div>
        </div>
      </section>

      {/* ALERTS */}
      {error && <div className="intel-banner intel-banner--warning">{error}</div>}
      {success && <div className="intel-banner intel-banner--success">{success}</div>}

      {/* STATS */}
      <section className="intel-stat-row">
        <article className="intel-stat">
          <div className="intel-stat__label">Recent Events</div>
          <div className="intel-stat__value">{stats.total}</div>
        </article>
        <article className="intel-stat intel-stat--danger">
          <div className="intel-stat__label">High Impact</div>
          <div className="intel-stat__value">{stats.highImpact}</div>
        </article>
        <article className="intel-stat">
          <div className="intel-stat__label">Last Player</div>
          <div className="intel-stat__value">{stats.last}</div>
        </article>
        <article className="intel-stat intel-stat--success">
          <div className="intel-stat__label">System Mode</div>
          <div className="intel-stat__value">ACTIVE</div>
        </article>
      </section>

      {/* GRID */}
      <section className="intel-grid intel-grid--tool">

        {/* FORM */}
        <article className="intel-panel intel-panel--controls">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Inject Event</h2>
          </div>

          <form onSubmit={handleSubmit} className="intel-form">

            <div className="intel-form-group">
              <label className="intel-label">Player</label>
              <input
                className="intel-input"
                value={playerQuery}
                onChange={(e) => handlePlayerInput(e.target.value)}
                placeholder="Search player..."
              />
              {suggestions.length > 0 && (
                <div className="intel-dropdown">
                  {suggestions.map((p, i) => (
                    <div key={i} onClick={() => {
                      setSelectedPlayer(p);
                      setPlayerQuery(p.player_name);
                      setSuggestions([]);
                    }}>
                      {p.player_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="intel-form-group">
              <label className="intel-label">Event Type</label>
              <select
                className="intel-select"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {eventTypeOptions.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="intel-form-group">
              <label className="intel-label">Impact ({impactScore})</label>
              <input
                type="range"
                min="1"
                max="10"
                value={impactScore}
                onChange={(e) => setImpactScore(Number(e.target.value))}
                className="intel-slider"
              />
            </div>

            <button className="intel-button intel-button--primary" disabled={loading}>
              {loading ? "Injecting..." : "Inject Event"}
            </button>

          </form>
        </article>

        {/* EVENTS TABLE */}
        <article className="intel-panel intel-panel--results">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Recent Events</h2>
          </div>

          <div className="intel-table-wrap">
            <table className="intel-table">
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
                    <td colSpan="4" className="intel-empty">No events recorded.</td>
                  </tr>
                ) : (
                  events.map((ev, i) => (
                    <tr key={i}>
                      <td>{ev.player_name}</td>
                      <td>
                        <span className="intel-badge">
                          {ev.event_type}
                        </span>
                      </td>
                      <td>{new Date(ev.event_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`intel-badge ${
                          ev.impact_score >= 8
                            ? "intel-badge--danger"
                            : ev.impact_score >= 5
                            ? "intel-badge--warning"
                            : "intel-badge--neutral"
                        }`}>
                          {ev.impact_score}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

      </section>

    </div>
  );
}

window.EventsAdmin = EventsAdmin;
