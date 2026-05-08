import React, { useEffect, useState } from "react";
import { api } from "../api";

function StandingsPage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getStandings(year)
      .then((data) => {
        if (!data || !data.standings) throw new Error("Unable to load standings.");
        setStandings(data.standings);
      })
      .catch((err) => setError(err?.message || "Failed to fetch league standings."))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div>
        <div className="skeleton-block skeleton-row h-lg w-60"></div>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-block" style={{ height: "120px", borderRadius: "8px", marginBottom: "1rem" }}></div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}><p className="text-muted">{error}</p></div>;
  }

  if (!standings || Object.keys(standings).length === 0) {
    return <div className="card"><p className="text-muted">No standings are available for {year}.</p></div>;
  }

  return (
    <div>
      {Object.entries(standings).map(([conference, divisions]) => (
        <section key={conference} style={{ marginBottom: "2rem" }}>
          <div className="section-label">{conference} Conference</div>
          {Object.entries(divisions).map(([division, teams]) => (
            <div key={division} style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.9rem", color: "var(--fg)", marginBottom: "0.75rem" }}>{division}</h3>
              <div className="data-table-wrap">
                <table style={{ minWidth: "580px" }}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>T</th>
                      <th>Win %</th>
                      <th>TSI</th>
                      <th>PF</th>
                      <th>PA</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.code}>
                        <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                        <td>{team.record.wins}</td>
                        <td>{team.record.losses}</td>
                        <td>{team.record.ties}</td>
                        <td className="text-accent" style={{ fontWeight: 600 }}>{(team.record.winPct * 100).toFixed(1)}%</td>
                        <td>{team.tsi.toFixed(1)}</td>
                        <td>{team.avgFor}</td>
                        <td>{team.avgAgainst}</td>
                        <td style={{ color: team.pointDiffPerGame > 0 ? "var(--accent-success)" : team.pointDiffPerGame < 0 ? "var(--accent-danger)" : "var(--muted)" }}>
                          {team.pointDiffPerGame > 0 ? "+" : ""}{team.pointDiffPerGame}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

window.StandingsPage = StandingsPage;

export default StandingsPage;
