const { useEffect, useState } = React;

function MatchupSimulatorPage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [teams, setTeams] = useState([]);
  const [team1, setTeam1] = useState(selectedTeam);
  const [team2, setTeam2] = useState("PHI");
  const [matchup, setMatchup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.api.getTeams().then((result) => {
      const list = result?.teams || [];
      setTeams(list);
      setTeam1(selectedTeam);
      setTeam2(list.find((team) => team.code !== selectedTeam)?.code || "PHI");
    }).catch(console.error);
  }, [selectedTeam]);

  useEffect(() => {
    if (!team1 || !team2 || team1 === team2) return;

    setLoading(true);
    setError("");

    window.api.getMatchup(team1, team2, year)
      .then(setMatchup)
      .catch((err) => setError(err?.message || "Unable to simulate matchup."))
      .finally(() => setLoading(false));
  }, [team1, team2, year]);

  if (loading) {
    return (
      <div className="card">
        <h2>Matchup Simulator</h2>
        <p className="text-muted">Simulating the projected outcome for {team1} vs {team2}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Matchup Simulator</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  const [left, right] = matchup?.teams || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Matchup Simulator</h1>
        <p className="text-small text-muted">
          Estimate the likely winner and margin for a head-to-head matchup between two NFL teams.
        </p>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <div style={{ flex: "1 1 280px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>Home team</label>
          <select
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            style={{ width: "100%", padding: "0.9rem", borderRadius: "10px", border: "1px solid #cbd5e1" }}
          >
            {teams.map((team) => (
              <option key={team.code} value={team.code}>{team.code} — {team.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 280px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>Away team</label>
          <select
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            style={{ width: "100%", padding: "0.9rem", borderRadius: "10px", border: "1px solid #cbd5e1" }}
          >
            {teams.map((team) => (
              <option key={team.code} value={team.code}>{team.code} — {team.name}</option>
            ))}
          </select>
        </div>
      </div>

      {matchup ? (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Projected Outcome</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div style={{ padding: "1rem", borderRadius: "12px", background: "#f8fafc" }}>
              <strong>{team1} Win %</strong>
              <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.5rem" }}>{matchup.homeWinProbability}%</div>
            </div>
            <div style={{ padding: "1rem", borderRadius: "12px", background: "#f8fafc" }}>
              <strong>{team2} Win %</strong>
              <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.5rem" }}>{matchup.awayWinProbability}%</div>
            </div>
            <div style={{ padding: "1rem", borderRadius: "12px", background: "#f8fafc" }}>
              <strong>Expected Margin</strong>
              <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.5rem" }}>{matchup.expectedMargin} pts</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Team Profiles</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {left && (
            <div style={{ padding: "1rem", borderRadius: "10px", background: "#fff" }}>
              <h3>{left.name} ({left.code})</h3>
              <div><strong>Record:</strong> {left.record.wins}-{left.record.losses}-{left.record.ties}</div>
              <div><strong>TSI:</strong> {left.tsi.toFixed(1)}</div>
              <div><strong>Point Diff:</strong> {left.averagePointDiff}</div>
              <div><strong>Playoff Odds:</strong> {left.playoffProbability ? `${left.playoffProbability}%` : "TBD"}</div>
            </div>
          )}
          {right && (
            <div style={{ padding: "1rem", borderRadius: "10px", background: "#fff" }}>
              <h3>{right.name} ({right.code})</h3>
              <div><strong>Record:</strong> {right.record.wins}-{right.record.losses}-{right.record.ties}</div>
              <div><strong>TSI:</strong> {right.tsi.toFixed(1)}</div>
              <div><strong>Point Diff:</strong> {right.averagePointDiff}</div>
              <div><strong>Playoff Odds:</strong> {right.playoffProbability ? `${right.playoffProbability}%` : "TBD"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.MatchupSimulatorPage = MatchupSimulatorPage;
