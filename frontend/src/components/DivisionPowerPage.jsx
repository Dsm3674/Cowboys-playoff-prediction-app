import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function DivisionPowerPage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    api
      .getDivisionPower(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.divisions)) {
          throw new Error("Missing division power metrics.");
        }
        setDivisions(data.divisions);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Unable to load division strength metrics.");
          setDivisions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const rankedTeams = useMemo(() => {
    const rows = divisions.flatMap((division) =>
      (division.teams || []).map((team) => ({
        ...team,
        division: division.division,
        conference: division.conference,
        averageTSI: division.averageTSI,
      }))
    );

    return rows.sort((a, b) => Number(b.tsi || 0) - Number(a.tsi || 0));
  }, [divisions]);

  const dallas =
    rankedTeams.find((team) => team.code === selectedTeam) ||
    rankedTeams.find((team) => team.code === "DAL") ||
    null;

  const topFive = rankedTeams.slice(0, 5);

  const formatNum = (value, digits = 1) => Number(value || 0).toFixed(digits);

  const formatSigned = (value, digits = 1) => {
    const num = Number(value || 0);
    return `${num > 0 ? "+" : ""}${num.toFixed(digits)}`;
  };

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-skeleton" style={{ height: 250 }} />
          <div className="intel-skeleton" style={{ height: 420, marginTop: 20 }} />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-empty">{error}</div>
        </section>
      </div>
    );
  }

  if (!divisions.length) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="intel-empty">No division power rankings available.</div>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <section className="intel-hero intel-hero--compact">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Division Intelligence</div>
          <h1 className="intel-title">DAL Power Rating</h1>
          <p className="intel-subtitle">
            A cleaner team-strength view with Dallas as the anchor card, followed by the league power board and division table.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          {dallas ? (
            <div className="intel-chip intel-chip--muted">
              Rank #{rankedTeams.findIndex((team) => team.code === dallas.code) + 1}
            </div>
          ) : null}
        </div>
      </section>

      {dallas ? (
        <section className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <div>
              <div className="intel-kicker">Team Strength Index</div>
              <h2 className="intel-section-title">Dallas Power Card</h2>
            </div>
            <div className="intel-chip intel-chip--muted">
              {dallas.division || "NFC East"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 280px) 1fr",
              gap: "18px",
              alignItems: "stretch",
            }}
          >
            <div
              className="intel-metric-card"
              style={{
                justifyContent: "center",
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div className="intel-metric-card__label">Overall Grade</div>
              <div
                className="intel-metric-card__value"
                style={{ fontSize: "4rem", lineHeight: 1, letterSpacing: "-0.05em" }}
              >
                {formatNum(dallas.tsi)}
              </div>
              <div className="text-muted">
                {((Number(dallas.record?.winPct || 0)) * 100).toFixed(1)}% win rate ·{" "}
                {formatSigned(dallas.pointDiffPerGame)}
              </div>
            </div>

            <div
              className="intel-metric-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Offense</div>
                <div className="intel-metric-card__value">
                  {formatNum(dallas.offense || dallas.components?.offense)}
                </div>
              </div>

              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Defense</div>
                <div className="intel-metric-card__value">
                  {formatNum(dallas.defense || dallas.components?.defense)}
                </div>
              </div>

              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Schedule</div>
                <div className="intel-metric-card__value">
                  {formatNum(dallas.schedule || dallas.components?.schedule)}
                </div>
              </div>

              <div className="intel-metric-card">
                <div className="intel-metric-card__label">QB Adj</div>
                <div className="intel-metric-card__value">
                  {formatNum(dallas.qbAdj || dallas.components?.qbAdj)}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="intel-grid intel-grid--main"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", alignItems: "start" }}
      >
        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Top 5 Power Board</h2>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {topFive.map((team, index) => {
              const isDallas = team.code === "DAL";

              return (
                <div
                  key={`${team.division}-${team.code}-${index}`}
                  className="intel-metric-card"
                  style={{
                    border: isDallas ? "1px solid rgba(0, 212, 170, 0.42)" : undefined,
                    boxShadow: isDallas
                      ? "0 0 0 1px rgba(0, 212, 170, 0.14) inset"
                      : undefined,
                  }}
                >
                  <div className="intel-metric-card__label">
                    #{index + 1} · {team.division}
                  </div>

                  <div
                    className="intel-metric-card__value"
                    style={{ fontSize: "2.1rem", lineHeight: 1.05 }}
                  >
                    {team.code} — {formatNum(team.tsi)}
                  </div>

                  <div className="text-muted" style={{ marginTop: 6 }}>
                    Win {(Number(team.record?.winPct || 0) * 100).toFixed(1)}% · Diff{" "}
                    {formatSigned(team.pointDiffPerGame)}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Division Strength Table</h2>
          </div>

          <div className="intel-table-wrap division-strength-scroll">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Division</th>
                  <th>TSI</th>
                  <th>Win %</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {rankedTeams.map((team) => {
                  const isDallas = team.code === "DAL";

                  return (
                    <tr key={`${team.division}-${team.code}`} className={isDallas ? "intel-row--active" : ""}>
                      <td>{team.code}</td>
                      <td>{team.division}</td>
                      <td>{formatNum(team.tsi)}</td>
                      <td>{(Number(team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                      <td>{formatSigned(team.pointDiffPerGame)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section
        className="division-summary-grid"
        style={{
          display: "grid",
          gap: "18px",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        }}
      >
        {divisions.map((division) => (
          <article key={`${division.conference}-${division.division}`} className="intel-panel">
            <div className="intel-panel__header">
              <div>
                <h2 className="intel-section-title" style={{ marginBottom: 4 }}>
                  {division.division}
                </h2>
                <div className="text-muted">{division.conference}</div>
              </div>

              <div className="intel-chip intel-chip--muted">
                Avg TSI {formatNum(division.averageTSI)}
              </div>
            </div>

            <div
              className="intel-metric-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Win %</div>
                <div className="intel-metric-card__value">
                  {(Number(division.averageWinPct || 0) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Point Diff</div>
                <div className="intel-metric-card__value">
                  {formatSigned(division.averagePointDiff)}
                </div>
              </div>

              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Leader</div>
                <div className="intel-metric-card__value">
                  {division.leader?.code || division.teams?.[0]?.code || "--"}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

window.DivisionPowerPage = DivisionPowerPage;

export default DivisionPowerPage;
