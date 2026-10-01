import React, { useEffect, useMemo, useState } from "react";
import { DEFAULT_SEASON } from "../workspace";
import { api } from "../api";

function ConferenceRacePage({ year = DEFAULT_SEASON }) {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.getStandings(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !data.standings) throw new Error("Unable to load conference standings.");
        setStandings(data.standings);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to fetch conference race data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const conferenceSummary = useMemo(() => {
    if (!standings) return [];
    return Object.entries(standings).map(([conference, divisions]) => {
      const teams = Object.values(divisions).flat();
      // The seven seeds under the NFL tiebreakers, if the season ended today;
      // before any games are played there are no seeds, so show win% leaders.
      const seeded = teams.filter((t) => t.seed != null).sort((a, b) => a.seed - b.seed);
      const topTeams = seeded.length
        ? seeded
        : [...teams].sort((a, b) => (b.record.winPct || 0) - (a.record.winPct || 0)).slice(0, 5);
      return { conference, topTeams, divisions, bySeed: seeded.length > 0 };
    });
  }, [standings]);

  if (loading) {
    return (
      <div>
        {[1,2].map(i => <div key={i} className="skeleton-block" style={{ height: "200px", borderRadius: "8px", marginBottom: "1.25rem" }}></div>)}
      </div>
    );
  }

  if (error) return <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}><p className="text-muted">{error}</p></div>;

  return (
    <div>
      {conferenceSummary.map((c) => (
        <section key={c.conference} style={{ marginBottom: "2.5rem" }}>
          <div className="section-label">{c.conference} Conference</div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.85rem", color: "var(--fg)", margin: "0 0 0.75rem 0" }}>
              {c.bySeed ? "Playoff picture if the season ended today" : "Top Contenders"}
            </h3>
            <div className="data-table-wrap">
              <table style={{ minWidth: "550px" }}>
                <thead><tr><th>{c.bySeed ? "Seed" : "#"}</th><th>Team</th><th>Record</th><th>Win %</th><th>TSI</th><th>Diff</th></tr></thead>
                <tbody>
                  {c.topTeams.map((team, i) => (
                    <tr key={team.code}>
                      <td style={{ fontWeight: 700, color: "var(--fg)" }}>{c.bySeed ? team.seed : i + 1}</td>
                      <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                      <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                      <td className="text-accent" style={{ fontWeight: 600 }}>{(team.record.winPct * 100).toFixed(1)}%</td>
                      <td>{team.tsi.toFixed(1)}</td>
                      <td style={{ color: team.pointDiffPerGame > 0 ? "var(--accent-success)" : team.pointDiffPerGame < 0 ? "var(--accent-danger)" : "var(--muted)" }}>
                        {team.pointDiffPerGame > 0 ? "+" : ""}{team.pointDiffPerGame}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {Object.entries(c.divisions).map(([div, teams]) => (
            <div key={div} style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.8rem", color: "var(--fg-dim)", margin: "0 0 0.5rem 0" }}>{div}</h4>
              <div className="data-table-wrap">
                <table style={{ minWidth: "500px" }}>
                  <thead><tr><th>Team</th><th>W</th><th>L</th><th>Win %</th><th>TSI</th><th>Diff</th></tr></thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.code}>
                        <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                        <td>{team.record.wins}</td>
                        <td>{team.record.losses}</td>
                        <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                        <td>{team.tsi.toFixed(1)}</td>
                        <td>{team.pointDiffPerGame}</td>
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

window.ConferenceRacePage = ConferenceRacePage;

export default ConferenceRacePage;
