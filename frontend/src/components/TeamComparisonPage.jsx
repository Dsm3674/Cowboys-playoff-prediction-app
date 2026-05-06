import React, { useEffect, useState } from "react";
import { api } from "../api";

function TeamComparisonPage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [teams, setTeams] = useState([]);
  const [firstTeam, setFirstTeam] = useState(selectedTeam);
  const [secondTeam, setSecondTeam] = useState("PHI");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTeams().then((result) => {
      if (result?.teams) {
        setTeams(result.teams);
        setFirstTeam(selectedTeam);
        const fallback = result.teams.find((team) => team.code !== selectedTeam)?.code || "PHI";
        setSecondTeam(fallback);
      }
    }).catch(console.error);
  }, [selectedTeam]);

  useEffect(() => {
    if (!firstTeam || !secondTeam || firstTeam === secondTeam) return;

    setLoading(true);
    setError("");

    api
      .getTeamComparison(firstTeam, secondTeam, year)
      .then((data) => {
        setComparison(data);
      })
      .catch((err) => {
        setError(err?.message || "Unable to compare teams.");
      })
      .finally(() => setLoading(false));
  }, [firstTeam, secondTeam, year]);

  function renderTeamCard(team) {
    if (!team) return null;
    return (
      <div className="card" style={{ minWidth: "280px", flex: 1 }}>
        <h3 style={{ marginTop: 0 }}>{team.name} ({team.code})</h3>
        <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.9rem" }}>
          <div><strong>Conference:</strong> {team.conference}</div>
          <div><strong>Division:</strong> {team.division}</div>
          <div><strong>Record:</strong> {team.record.wins}-{team.record.losses}-{team.record.ties}</div>
          <div><strong>Win %:</strong> {(team.record.winPct * 100).toFixed(1)}%</div>
          <div><strong>TSI:</strong> {team.tsi.toFixed(1)} / 100</div>
          <div><strong>Average PF:</strong> {team.averages.avgFor.toFixed(1)}</div>
          <div><strong>Average PA:</strong> {team.averages.avgAgainst.toFixed(1)}</div>
          <div><strong>Avg. Diff:</strong> {team.averages.pointDiffPerGame.toFixed(1)}</div>
        </div>
      </div>
    );
  }

  function renderHeadToHead() {
    if (!comparison?.headToHead || comparison.headToHead.length === 0) {
      return <p className="text-small text-muted">No head-to-head games available in the current schedule.</p>;
    }

    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Head-to-Head Matchups</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "520px" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Home</th>
                <th>Away</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {comparison.headToHead.map((game) => (
                <tr key={game.id || `${game.date}-${game.homeTeamAbbr}-${game.awayTeamAbbr}`}>
                  <td>{new Date(game.date).toLocaleDateString()}</td>
                  <td>{game.homeTeamName}</td>
                  <td>{game.awayTeamName}</td>
                  <td>{game.homeScore} - {game.awayScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <h2>Team Comparison</h2>
        <p className="text-muted">Comparing {firstTeam} and {secondTeam} for {year}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Team Comparison</h2>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Team Comparison</h1>
        <p className="text-small text-muted">
          Compare two NFL teams side-by-side, including performance, record, and head-to-head schedule context.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ minWidth: "220px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>First team</label>
            <select
              value={firstTeam}
              onChange={(e) => setFirstTeam(e.target.value)}
              style={{ width: "100%", padding: "0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              {teams.map((team) => (
                <option key={team.code} value={team.code}>{team.code} — {team.name}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: "220px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Second team</label>
            <select
              value={secondTeam}
              onChange={(e) => setSecondTeam(e.target.value)}
              style={{ width: "100%", padding: "0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              {teams.map((team) => (
                <option key={team.code} value={team.code}>{team.code} — {team.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        {renderTeamCard(comparison?.teams?.[0])}
        {renderTeamCard(comparison?.teams?.[1])}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Comparison Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "10px" }}>
            <strong>TSI Gap</strong>
            <div>{comparison?.difference?.tsiDifference}</div>
          </div>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "10px" }}>
            <strong>Win % Gap</strong>
            <div>{(comparison?.difference?.winPctDifference * 100).toFixed(1)}%</div>
          </div>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "10px" }}>
            <strong>Point Diff Gap</strong>
            <div>{comparison?.difference?.pointDiffDifference.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {renderHeadToHead()}
    </div>
  );
}

window.TeamComparisonPage = TeamComparisonPage;

export default TeamComparisonPage;
