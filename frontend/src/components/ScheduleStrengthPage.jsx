import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function ScheduleStrengthPage({ year = new Date().getFullYear() }) {
  const [scheduleStrength, setScheduleStrength] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    api
      .getScheduleStrength(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.scheduleStrength)) {
          throw new Error("Schedule strength information is unavailable.");
        }
        setScheduleStrength(data.scheduleStrength);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Unable to load schedule strength data.");
          setScheduleStrength([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div>
        <div className="data-grid three-col" style={{ marginBottom: "1.25rem" }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-block metric-tile" style={{ height: "90px" }}></div>
          ))}
        </div>
        <div className="skeleton-block" style={{ height: "300px", borderRadius: "8px" }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}>
        <h3 style={{ marginTop: 0, color: "var(--accent-danger)" }}>Error</h3>
        <p className="text-muted">{error}</p>
      </div>
    );
  }

  const top5 = scheduleStrength.slice(0, 5);
  const maxScore = Math.max(...scheduleStrength.map(t => t.strengthScore || 0), 1);
  const hardest = scheduleStrength[0];

  return (
    <div>
      {hardest && (
        <div className="key-insight" style={{ marginBottom: "1.5rem" }}>
          {hardest.code} faces the toughest remaining schedule with a strength score of {hardest.strengthScore}
        </div>
      )}

      <div className="section-label">Top 5 Toughest Schedules</div>
      <div className="data-grid auto-fit" style={{ marginBottom: "1.75rem" }}>
        {top5.map((team, index) => (
          <div key={team.code} className="metric-tile">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-value accent">{team.strengthScore}</div>
                <div className="metric-label">#{index + 1} — {team.code}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--fg-dim)" }}>
                  {team.record?.wins}-{team.record?.losses}-{team.record?.ties}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                  {team.remainingGames} games left
                </div>
              </div>
            </div>
            <div className="strength-bar">
              <div
                className="strength-bar__fill"
                style={{ width: `${(team.strengthScore / maxScore) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">Full Rankings</div>
      <div className="data-table-wrap">
        <table style={{ minWidth: "680px" }}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Strength</th>
              <th style={{ width: "160px" }}>Visual</th>
              <th>Remaining</th>
              <th>Avg Opp TSI</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {scheduleStrength.map((team, index) => (
              <tr
                key={team.code}
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedTeam(expandedTeam === team.code ? null : team.code)}
              >
                <td style={{ fontWeight: 700, color: "var(--fg)" }}>{index + 1}</td>
                <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                <td className="text-accent" style={{ fontWeight: 700 }}>{team.strengthScore}</td>
                <td>
                  <div className="strength-bar">
                    <div
                      className="strength-bar__fill"
                      style={{ width: `${(team.strengthScore / maxScore) * 100}%` }}
                    ></div>
                  </div>
                </td>
                <td>{team.remainingGames}</td>
                <td>{team.averageOpponentTsi}</td>
                <td>{team.record?.wins}-{team.record?.losses}-{team.record?.ties}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedTeam && (() => {
        const team = scheduleStrength.find(t => t.code === expandedTeam);
        if (!team) return null;
        return (
          <div className="card" style={{ marginTop: "1.25rem", borderTop: "2px solid var(--accent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>{team.code} — Remaining Schedule</h3>
                <p className="text-muted" style={{ margin: 0 }}>{team.remainingGames} games remaining</p>
              </div>
              <button
                className="sub-tab"
                onClick={() => setExpandedTeam(null)}
                style={{ fontSize: "0.72rem" }}
              >✕ Close</button>
            </div>
            <div className="data-grid auto-fit">
              {team.remainingSchedule.map((game, i) => (
                <div key={i} className="metric-tile">
                  <div className="metric-value" style={{ fontSize: "1.1rem" }}>{game.opponent}</div>
                  <div className="metric-label">{game.date ? new Date(game.date).toLocaleDateString() : "TBD"}</div>
                  <div className="metric-sub">{game.location}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

window.ScheduleStrengthPage = ScheduleStrengthPage;

export default ScheduleStrengthPage;
