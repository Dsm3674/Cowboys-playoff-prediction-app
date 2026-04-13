const { useEffect, useMemo, useState } = React;

function LeagueForecastPage({ year = new Date().getFullYear() }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    window.api
      .getLeagueForecast(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.forecast)) {
          throw new Error("Forecast data is unavailable.");
        }
        setForecast(data.forecast);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Unable to load the league forecast.");
          setForecast([]);
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

  const topTeams = useMemo(() => forecast.slice(0, 10), [forecast]);

  const headline = useMemo(() => {
    if (!forecast.length) {
      return {
        label: "League Forecast",
        title: "Projection models will appear here once the feed finishes loading.",
        note: "Use this board to compare remainder-of-season outlook across the full league.",
      };
    }

    const leader = forecast[0];

    return {
      label: "Projection Board",
      title: `${leader.name || leader.code} currently leads the league forecast entering the rest of the season.`,
      note: `${leader.code} projects to ${leader.projectedWins} wins with a ${leader.projectedWinRate}% projected win rate and ${leader.remainingGames} games left.`,
    };
  }, [forecast]);

  const summaryStats = useMemo(() => {
    if (!forecast.length) {
      return [
        { label: "Teams Modeled", value: "--", tone: "neutral" },
        { label: "Top Forecast", value: "--", tone: "accent" },
        { label: "Top Projection", value: "--", tone: "success" },
        { label: "Avg Wins", value: "--", tone: "neutral" },
      ];
    }

    const avgProjectedWins = (
      forecast.reduce((sum, team) => sum + (Number(team.projectedWins) || 0), 0) /
      forecast.length
    ).toFixed(1);

    return [
      {
        label: "Teams Modeled",
        value: forecast.length,
        tone: "neutral",
      },
      {
        label: "Top Forecast",
        value: forecast[0]?.code || "--",
        tone: "accent",
      },
      {
        label: "Top Projection",
        value: forecast[0] ? `${forecast[0].projectedWins}` : "--",
        tone: "success",
      },
      {
        label: "Avg Projected Wins",
        value: avgProjectedWins,
        tone: "neutral",
      },
    ];
  }, [forecast]);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">League Forecast</div>
            <h1 className="intel-title">Loading projection engine...</h1>
            <p className="intel-subtitle">
              Building the projected league leaderboard for {year}.
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
            <div className="intel-kicker">League Forecast</div>
            <h1 className="intel-title">Forecast board unavailable</h1>
            <p className="intel-subtitle">
              The projection feed could not be loaded for {year}.
            </p>
          </div>
        </section>

        <div className="intel-banner intel-banner--warning">{error}</div>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">{headline.label}</div>
          <h1 className="intel-title">League Forecast</h1>
          <p className="intel-subtitle">{headline.title}</p>
          <p className="intel-note">{headline.note}</p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">
            Full league projection
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

      <section className="intel-grid intel-grid--main">
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Primary Board</div>
              <h2 className="intel-section-title">Top 10 Forecasted Teams</h2>
            </div>
            <div className="intel-section-meta">
              Projection leaders
            </div>
          </div>

          {topTeams.length ? (
            <div className="intel-table-wrap">
              <table className="intel-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Current Record</th>
                    <th>Projected Wins</th>
                    <th>Projected Win %</th>
                    <th>TSI</th>
                  </tr>
                </thead>
                <tbody>
                  {topTeams.map((team, index) => (
                    <tr key={team.code}>
                      <td>{String(index + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="intel-team">
                          <span className="intel-team__code">{team.code}</span>
                          <span className="intel-team__name">
                            {team.name || team.code}
                          </span>
                        </div>
                      </td>
                      <td>
                        {team.record?.wins}-{team.record?.losses}-{team.record?.ties}
                      </td>
                      <td>
                        <span className="intel-badge intel-badge--success">
                          {team.projectedWins}
                        </span>
                      </td>
                      <td>{team.projectedWinRate}%</td>
                      <td>
                        <span className="intel-badge intel-badge--accent">
                          {Number(team.tsi || 0).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="intel-empty">No top forecast teams available.</div>
          )}
        </article>

        <article className="intel-panel">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Forecast Snapshot</div>
              <h2 className="intel-section-title">Top Signals</h2>
            </div>
          </div>

          {topTeams.length ? (
            <div className="intel-rank-list">
              {topTeams.slice(0, 5).map((team, index) => (
                <div key={team.code} className="intel-rank-row">
                  <div className="intel-rank-row__left">
                    <span className="intel-rank-row__index">{index + 1}</span>
                    <div>
                      <div className="intel-rank-row__name">
                        {team.name || team.code}
                      </div>
                      <div className="intel-rank-row__meta">
                        {team.conference} · {team.division}
                      </div>
                    </div>
                  </div>
                  <div className="intel-rank-row__right">
                    <span className="intel-badge intel-badge--accent">
                      {team.projectionScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="intel-empty">No forecast highlights available.</div>
          )}
        </article>
      </section>

      <section className="intel-grid intel-grid--support">
        <article className="intel-panel">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Full Board</div>
              <h2 className="intel-section-title">Forecast Leaderboard</h2>
            </div>
            <div className="intel-section-meta">
              All projected teams
            </div>
          </div>

          {forecast.length ? (
            <div className="intel-table-wrap">
              <table className="intel-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Conference</th>
                    <th>Division</th>
                    <th>Current Win %</th>
                    <th>Projected Wins</th>
                    <th>Remaining</th>
                    <th>Projection Score</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((team) => (
                    <tr key={team.code}>
                      <td>
                        <div className="intel-team">
                          <span className="intel-team__code">{team.code}</span>
                          <span className="intel-team__name">
                            {team.name || team.code}
                          </span>
                        </div>
                      </td>
                      <td>{team.conference}</td>
                      <td>{team.division}</td>
                      <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                      <td>{team.projectedWins}</td>
                      <td>{team.remainingGames}</td>
                      <td>
                        <span className="intel-badge intel-badge--neutral">
                          {team.projectionScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="intel-empty">Forecast data is unavailable.</div>
          )}
        </article>
      </section>
    </div>
  );
}

window.LeagueForecastPage = LeagueForecastPage;
