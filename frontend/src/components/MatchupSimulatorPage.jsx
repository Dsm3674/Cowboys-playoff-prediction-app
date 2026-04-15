const { useEffect, useState } = React;

function MatchupSimulatorPage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [teams, setTeams] = useState([]);
  const [team1, setTeam1] = useState(selectedTeam);
  const [team2, setTeam2] = useState("PHI");
  const [matchup, setMatchup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.api
      .getTeams()
      .then((result) => {
        const list = result?.teams || [];
        setTeams(list);
        setTeam1(selectedTeam);
        setTeam2(list.find((team) => team.code !== selectedTeam)?.code || "PHI");
      })
      .catch(console.error);
  }, [selectedTeam]);

  useEffect(() => {
    if (!team1 || !team2 || team1 === team2) return;

    setLoading(true);
    setError("");

    window.api
      .getMatchup(team1, team2, year)
      .then(setMatchup)
      .catch((err) => setError(err?.message || "Unable to simulate matchup."))
      .finally(() => setLoading(false));
  }, [team1, team2, year]);

  const [left, right] = matchup?.teams || [];

  const selectStyle = {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: "12px",
    border: "1px solid var(--line)",
    background: "var(--bg-panel)",
    color: "var(--fg)",
    outline: "none",
    boxShadow: "none",
  };

  const panelStyle = {
    padding: "1rem 1.1rem",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(14, 26, 38, 0.96), rgba(10, 21, 32, 0.98))",
    border: "1px solid var(--line)",
    boxShadow: "var(--shadow-soft)",
    minWidth: 0,
  };

  const valueStyle = {
    fontSize: "2.5rem",
    fontWeight: 800,
    marginTop: "0.55rem",
    color: "var(--fg-strong)",
    lineHeight: 1,
    letterSpacing: "-0.03em",
  };

  const profileRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.55rem 0",
    borderBottom: "1px solid var(--line-soft)",
  };

  const renderTeamProfile = (team) => {
    if (!team) return null;

    return (
      <div style={panelStyle}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            color: "var(--fg-strong)",
            fontSize: "1.15rem",
            lineHeight: 1.2,
          }}
        >
          {team.name} ({team.code})
        </h3>

        <div style={profileRowStyle}>
          <span className="text-muted">Record</span>
          <strong style={{ color: "var(--fg-strong)" }}>
            {team.record.wins}-{team.record.losses}-{team.record.ties}
          </strong>
        </div>

        <div style={profileRowStyle}>
          <span className="text-muted">TSI</span>
          <strong style={{ color: "var(--fg-strong)" }}>{team.tsi.toFixed(1)}</strong>
        </div>

        <div style={profileRowStyle}>
          <span className="text-muted">Point Diff</span>
          <strong style={{ color: "var(--fg-strong)" }}>
            {team.averagePointDiff ?? "—"}
          </strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", paddingTop: "0.55rem" }}>
          <span className="text-muted">Playoff Odds</span>
          <strong style={{ color: "var(--fg-strong)" }}>
            {team.playoffProbability != null ? `${team.playoffProbability}%` : "TBD"}
          </strong>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Matchup Simulator</h1>
        <p className="text-small text-muted">
          Estimate the likely winner and margin for a head-to-head matchup between two NFL teams.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "var(--fg-soft)",
              fontWeight: 600,
            }}
          >
            Home team
          </label>
          <select value={team1} onChange={(e) => setTeam1(e.target.value)} style={selectStyle}>
            {teams.map((team) => (
              <option key={team.code} value={team.code}>
                {team.code} — {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "var(--fg-soft)",
              fontWeight: 600,
            }}
          >
            Away team
          </label>
          <select value={team2} onChange={(e) => setTeam2(e.target.value)} style={selectStyle}>
            {teams.map((team) => (
              <option key={team.code} value={team.code}>
                {team.code} — {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <h2>Matchup Simulator</h2>
          <p className="text-muted">
            Simulating the projected outcome for {team1} vs {team2}...
          </p>
        </div>
      ) : error ? (
        <div className="card">
          <h2>Matchup Simulator</h2>
          <p className="text-danger">{error}</p>
        </div>
      ) : matchup ? (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Projected Outcome</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            <div style={panelStyle}>
              <div className="text-muted" style={{ fontWeight: 700 }}>
                {team1} Win %
              </div>
              <div style={valueStyle}>{matchup.homeWinProbability}%</div>
            </div>

            <div style={panelStyle}>
              <div className="text-muted" style={{ fontWeight: 700 }}>
                {team2} Win %
              </div>
              <div style={valueStyle}>{matchup.awayWinProbability}%</div>
            </div>

            <div style={panelStyle}>
              <div className="text-muted" style={{ fontWeight: 700 }}>
                Expected Margin
              </div>
              <div style={valueStyle}>{matchup.expectedMargin} pts</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Team Profiles</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1rem",
          }}
        >
          {renderTeamProfile(left)}
          {renderTeamProfile(right)}
        </div>
      </div>
    </div>
  );
}

window.MatchupSimulatorPage = MatchupSimulatorPage;
