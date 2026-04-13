const { useEffect, useMemo, useState } = React;

function DivisionPowerPage({ year = new Date().getFullYear() }) {
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
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const headline = useMemo(() => {
    if (!divisions.length) {
      return {
        label: "Division Power",
        title: "Division strength metrics will appear here once the league feed loads.",
        note: "Use this page to compare average TSI, win percentage, and point differential across every division.",
      };
    }

    const strongest = [...divisions].sort(
      (a, b) => (b.averageTSI || 0) - (a.averageTSI || 0)
    )[0];

    return {
      label: "Division Power",
      title: `${strongest.division} in the ${strongest.conference} currently leads the division power board.`,
      note: `Average TSI sits at ${strongest.averageTSI}, with ${(
        (strongest.averageWinPct || 0) * 100
      ).toFixed(1)}% average win rate and ${strongest.averagePointDiff} point differential per game.`,
    };
  }, [divisions]);

  const summaryStats = useMemo(() => {
    if (!divisions.length) {
      return [
        { label: "Divisions", value: "--", tone: "neutral" },
        { label: "Top Division", value: "--", tone: "accent" },
        { label: "Top Leader", value: "--", tone: "success" },
        { label: "Avg TSI", value: "--", tone: "neutral" },
      ];
    }

    const strongest = [...divisions].sort(
      (a, b) => (b.averageTSI || 0) - (a.averageTSI || 0)
    )[0];

    const averageTSI = (
      divisions.reduce((sum, division) => sum + (Number(division.averageTSI) || 0), 0) /
      divisions.length
    ).toFixed(1);

    return [
      {
        label: "Divisions",
        value: divisions.length,
        tone: "neutral",
      },
      {
        label: "Top Division",
        value: strongest?.division || "--",
        tone: "accent",
      },
      {
        label: "Top Leader",
        value: strongest?.leader?.code || "--",
        tone: "success",
      },
      {
        label: "League Avg TSI",
        value: averageTSI,
        tone: "neutral",
      },
    ];
  }, [divisions]);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Division Power</div>
            <h1 className="intel-title">Loading division intelligence...</h1>
            <p className="intel-subtitle">
              Pulling division strength, average TSI, and point differential metrics for {year}.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Division Power</div>
            <h1 className="intel-title">Division board unavailable</h1>
            <p className="intel-subtitle">
              Division strength metrics could not be loaded for {year}.
            </p>
          </div>
        </section>

        <div className="intel-banner intel-banner--warning">{error}</div>
      </div>
    );
  }

  if (divisions.length === 0) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Division Power</div>
            <h1 className="intel-title">No division rankings available</h1>
            <p className="intel-subtitle">
              The division strength feed has not returned any rankings yet.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">{headline.label}</div>
          <h1 className="intel-title">Division Power Rankings</h1>
          <p className="intel-subtitle">{headline.title}</p>
          <p className="intel-note">{headline.note}</p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">
            Division strength board
          </div>
        </div>
      </section>

      <section className="intel-stat-row">
        {summaryStats.map((stat) => (
          <article key={stat.label} className={`intel-stat intel-stat--${stat.tone}`}>
            <div className="intel-stat__label">{stat.label}</div>
            <div className="intel-stat__value">{stat.value}</div>
          </article>
        ))}
      </section>

      <section className="intel-grid intel-grid--support">
        {divisions.map((division) => (
          <article
            key={`${division.conference}-${division.division}`}
            className="intel-panel"
          >
            <div className="intel-panel__header">
              <div>
                <div className="intel-section-kicker">{division.conference}</div>
                <h2 className="intel-section-title">{division.division}</h2>
              </div>
              <div className="intel-section-meta">Avg TSI {division.averageTSI}</div>
            </div>

            <section className="intel-metric-grid">
              <article className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Win %</div>
                <div className="intel-metric-card__value">
                  {((division.averageWinPct || 0) * 100).toFixed(1)}%
                </div>
              </article>

              <article className="intel-metric-card">
                <div className="intel-metric-card__label">Avg Point Diff</div>
                <div className="intel-metric-card__value">
                  {division.averagePointDiff}
                </div>
              </article>

              <article className="intel-metric-card">
                <div className="intel-metric-card__label">Leader</div>
                <div className="intel-metric-card__value">
                  {division.leader?.code || "--"}
                </div>
              </article>
            </section>

            <div className="intel-table-wrap">
              <table className="intel-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>TSI</th>
                    <th>Win %</th>
                    <th>Point Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {division.teams.map((team) => (
                    <tr key={team.code}>
                      <td>
                        <div className="intel-team">
                          <span className="intel-team__code">{team.code}</span>
                          <span className="intel-team__name">
                            {team.name || team.code}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="intel-badge intel-badge--accent">
                          {Number(team.tsi || 0).toFixed(1)}
                        </span>
                      </td>
                      <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                      <td>{team.pointDiffPerGame}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

window.DivisionPowerPage = DivisionPowerPage;
