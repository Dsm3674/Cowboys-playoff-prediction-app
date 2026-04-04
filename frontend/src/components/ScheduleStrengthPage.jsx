const { useEffect, useState } = React;

function ScheduleStrengthPage({ year = new Date().getFullYear() }) {
  const [scheduleStrength, setScheduleStrength] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    window.api
      .getScheduleStrength(year)
      .then((data) => {
        if (!data || !Array.isArray(data.scheduleStrength)) {
          throw new Error("Schedule strength information is unavailable.");
        }
        setScheduleStrength(data.scheduleStrength);
      })
      .catch((err) => {
        setError(err?.message || "Unable to load schedule strength data.");
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="card">
        <h2>Schedule Strength</h2>
        <p className="text-muted">Evaluating upcoming remaining slates for all NFL teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Schedule Strength</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Schedule Strength</h1>
        <p className="text-small text-muted">
          The remaining slate rating for each team shows which teams face the toughest finishes and which have smoother runs.
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Toughest Remaining Schedules</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "720px" }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Strength Score</th>
                <th>Remaining Games</th>
                <th>Avg Opponent TSI</th>
                <th>Current Record</th>
              </tr>
            </thead>
            <tbody>
              {scheduleStrength.map((team, index) => (
                <tr key={team.code}>
                  <td>{index + 1}</td>
                  <td>{team.code}</td>
                  <td>{team.strengthScore}</td>
                  <td>{team.remainingGames}</td>
                  <td>{team.averageOpponentTsi}</td>
                  <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Upcoming Games by Team</h2>
        {scheduleStrength.map((team) => (
          <div key={team.code} style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "12px", background: "#f8fafc" }}>
            <h3 style={{ margin: 0 }}>{team.code} — Remaining {team.remainingGames} games</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              {team.remainingSchedule.map((game, index) => (
                <div key={index} style={{ padding: "0.75rem", background: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700 }}>{game.opponent}</div>
                  <div style={{ fontSize: "0.8rem", color: "#475569" }}>{game.date ? new Date(game.date).toLocaleDateString() : "TBD"}</div>
                  <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>{game.location}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ScheduleStrengthPage = ScheduleStrengthPage;
