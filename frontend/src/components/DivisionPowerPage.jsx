const { useEffect, useMemo, useState } = React;

function DivisionPowerPage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    window.api
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
    return divisions
      .flatMap((division) =>
        (division.teams || []).map((team) => ({
          ...team,
          division: division.division,
          conference: division.conference,
          averageTSI: division.averageTSI,
        }))
      )
      .sort((a, b) => (b.tsi || 0) - (a.tsi || 0));
  }, [divisions]);

  const dallas = rankedTeams.find((team) => team.code === selectedTeam) || rankedTeams.find((team) => team.code === "DAL");
  const topFive = rankedTeams.slice(0, 5);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-panel">
          <div className="skeleton-block" style={{ height: 220, borderRadius: 24, marginBottom: "1rem" }} />
          <div className="skeleton-block" style={{ height: 320, borderRadius: 24 }} />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-page">
        <section className="intel-banner intel-banner--warning">{error}</section>
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
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Division Intelligence</div>
          <h1 className="intel-title">Dallas Team Power Rating</h1>
          <p className="intel-subtitle">
            Compare Dallas against every division environment using TSI, win rate, and scoring margin.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">
            {dallas ? `${dallas.code} rank #${rankedTeams.findIndex((t) => t.code === dallas.code) + 1}` : "League view"}
          </div>
        </div>
      </section>

      {dallas ? (
        <section className="intel-stat-row">
          <article className="intel-stat intel-stat--accent">
            <div className="intel-stat__label">Dallas TSI</div>
            <div className="intel-stat__value">{Number(dallas.tsi || 0).toFixed(1)}</div>
          </article>

          <article className="intel-stat">
            <div className="intel-stat__label">Dallas Win %</div>
            <div className="intel-stat__value">{((dallas.record?.winPct || 0) * 100).toFixed(1)}%</div>
          </article>

          <article className="intel-stat">
            <div className="intel-stat__label">Dallas Point Diff</div>
            <div className="intel-stat__value">
              {(dallas.pointDiffPerGame || 0) > 0 ? "+" : ""}
              {Number(dallas.pointDiffPerGame || 0).toFixed(1)}
            </div>
          </article>

          <article className="intel-stat">
            <div className="intel-stat__label">Division</div>
            <div className="intel-stat__value">{dallas.division || "--"}</div>
          </article>
        </section>
      ) : null}

      <section className="intel-grid intel-grid--main" style={{ alignItems: "start" }}>
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Top 5 Power Board</h2>
          </div>

          <div className="intel-stack">
            {topFive.map((team, index) => (
              <div
                key={`${team.code}-${index}`}
                className="intel-metric-card"
                style={{
                  border: team.code === "DAL" ? "1px solid rgba(0, 212, 170, 0.5)" : undefined,
                  boxShadow: team.code === "DAL" ? "0 0 0 1px rgba(0, 212, 170, 0.15) inset" : undefined,
                }}
              >
                <div className="intel-metric-card__label">#{index + 1} · {team.division}</div>
                <div className="intel-metric-card__value" style={{ fontSize: "1.2rem" }}>
                  {team.code} — {Number(team.tsi || 0).toFixed(1)}
                </div>
                <div className="text-muted" style={{ fontSize: "0.92rem" }}>
                  Win % {((team.record?.winPct || 0) * 100).toFixed(1)} · Diff {team.pointDiffPerGame > 0 ? "+" : ""}{Number(team.pointDiffPerGame || 0).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Division Strength Table</h2>
          </div>

          <div className="intel-table-wrap">
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
                {rankedTeams.map((team) => (
                  <tr
                    key={`${team.division}-${team.code}`}
                    className={team.code === "DAL" ? "intel-row--active" : ""}
                  >
                    <td>{team.code}</td>
                    <td>{team.division}</td>
                    <td>{Number(team.tsi || 0).toFixed(1)}</td>
                    <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                    <td>
                      {team.pointDiffPerGame > 0 ? "+" : ""}
                      {Number(team.pointDiffPerGame || 0).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="intel-stack" style={{ marginTop: "1.25rem" }}>
        {divisions.map((division) => (
          <article key={`${division.conference}-${division.division}`} className="intel-panel">
            <div className="intel-panel__header">
              <div>
                <h2 className="intel-section-title" style={{ marginBottom: 4 }}>{division.division}</h2>
                <div className="text-muted">{division.conference}</div>
              </div>
              <div className="intel-chip intel-chip--muted">Avg TSI {Number(division.averageTSI || 0).toFixed(1)}</div>
            </div>

            <div className="intel-metric-grid">
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Win %</div>
                <div className="intel-metric-card__value">{((division.averageWinPct || 0) * 100).toFixed(1)}%</div>
              </div>
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Point Diff</div>
                <div className="intel-metric-card__value">
                  {(division.averagePointDiff || 0) > 0 ? "+" : ""}
                  {Number(division.averagePointDiff || 0).toFixed(1)}
                </div>
              </div>
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Leader</div>
                <div className="intel-metric-card__value">{division.leader?.code || "--"}</div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

window.DivisionPowerPage = DivisionPowerPage;
