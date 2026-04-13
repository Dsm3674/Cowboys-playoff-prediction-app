const { useEffect, useMemo, useState } = React;

function LeagueInsightsPage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [divisionPower, setDivisionPower] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [playoffPulse, setPlayoffPulse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.allSettled([
      window.api.getStandings(year),
      window.api.getDivisionPower(year),
      window.api.getLeagueForecast(year),
      window.api.getPlayoffPulse(year),
    ])
      .then((results) => {
        if (cancelled) return;

        const [standingsResult, divisionResult, forecastResult, pulseResult] = results;

        if (standingsResult.status === "fulfilled") {
          setStandings(standingsResult.value?.standings || null);
        } else {
          setStandings(null);
        }

        if (divisionResult.status === "fulfilled") {
          setDivisionPower(divisionResult.value?.divisions || []);
        } else {
          setDivisionPower([]);
        }

        if (forecastResult.status === "fulfilled") {
          setForecast(forecastResult.value?.forecast || []);
        } else {
          setForecast([]);
        }

        if (pulseResult.status === "fulfilled") {
          setPlayoffPulse(pulseResult.value?.pulse || []);
        } else {
          setPlayoffPulse([]);
        }

        const failed = results.filter((item) => item.status === "rejected");
        if (failed.length > 0) {
          setError("Some league intelligence feeds failed to load. Available modules are still shown below.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load league intelligence.");
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

  const conferenceLeaders = useMemo(() => {
    if (!standings) return [];

    return Object.entries(standings).map(([conference, divisions]) => {
      const flattened = Object.values(divisions || {}).flat();
      const sorted = [...flattened].sort((a, b) => {
        const winPctDiff = (b.record?.winPct || 0) - (a.record?.winPct || 0);
        if (winPctDiff !== 0) return winPctDiff;
        return (b.tsi || 0) - (a.tsi || 0);
      });

      return {
        conference,
        leader: sorted[0] || null,
      };
    });
  }, [standings]);

  const topForecastTeams = useMemo(() => {
    return [...forecast].slice(0, 8);
  }, [forecast]);

  const topPlayoffTeams = useMemo(() => {
    return [...playoffPulse].slice(0, 6);
  }, [playoffPulse]);

  const strongestDivisions = useMemo(() => {
    return [...divisionPower]
      .sort((a, b) => (b.averageTSI || 0) - (a.averageTSI || 0))
      .slice(0, 6);
  }, [divisionPower]);

  const headline = useMemo(() => {
    const bestForecast = topForecastTeams[0];
    const bestPulse = topPlayoffTeams[0];
    const bestDivision = strongestDivisions[0];

    if (!bestForecast && !bestPulse && !bestDivision) {
      return {
        label: "League HQ",
        title: "League intelligence is waiting on live forecast, standings, and playoff feeds.",
        note: "This page becomes the command center once the analytics modules finish loading.",
      };
    }

    return {
      label: "League HQ",
      title: bestForecast
        ? `${bestForecast.name} leads the current league forecast board.`
        : "League-wide forecasting is active.",
      note: bestDivision
        ? `${bestDivision.division} in the ${bestDivision.conference} is currently the strongest division by average TSI.`
        : bestPulse
          ? `${bestPulse.name} leads the playoff pressure model right now.`
          : "Forecast, playoff, and division intelligence are now active.",
    };
  }, [topForecastTeams, topPlayoffTeams, strongestDivisions]);

  const summaryStats = useMemo(() => {
    const teamsModeled = forecast.length || 0;
    const avgProjectedWins =
      forecast.length > 0
        ? (
            forecast.reduce((sum, team) => sum + (Number(team.projectedWins) || 0), 0) / forecast.length
          ).toFixed(1)
        : "--";

    return [
      {
        label: "Teams Modeled",
        value: teamsModeled || "--",
        tone: "neutral",
      },
      {
        label: "Avg Projected Wins",
        value: avgProjectedWins,
        tone: "neutral",
      },
      {
        label: "Top Forecast",
        value: topForecastTeams[0]?.code || "--",
        tone: "accent",
      },
      {
        label: "Playoff Pressure Leader",
        value: topPlayoffTeams[0]?.code || "--",
        tone: "success",
      },
    ];
  }, [forecast, topForecastTeams, topPlayoffTeams]);

  const emptyState = (message) => (
    <div className="intel-empty">{message}</div>
  );

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">League HQ</div>
            <h1 className="intel-title">Loading league intelligence...</h1>
            <p className="intel-subtitle">
              Pulling standings, division strength, forecast models, and playoff pressure.
            </p>
            <p className="intel-note">
              Building the league command board for season {year}.
            </p>
          </div>
          <div className="intel-hero__meta">
            <div className="intel-chip">Season {year}</div>
            <div className="intel-chip intel-chip--muted">Syncing feeds</div>
          </div>
        </section>

        <section className="intel-stat-row">
          {["Loading", "Forecast", "Playoff", "Divisions"].map((label, index) => (
            <article key={label} className={`intel-stat intel-stat--${index === 2 ? "success" : "neutral"}`}>
              <div className="intel-stat__label">{label}</div>
              <div className="intel-stat__value">--</div>
            </article>
          ))}
        </section>

        <section className="intel-grid intel-grid--main">
          <article className="intel-panel intel-panel--primary">
            <div className="intel-loading">Syncing league feeds...</div>
          </article>
          <div className="intel-stack">
            <article className="intel-panel">
              <div className="intel-loading">Calculating playoff pressure...</div>
            </article>
            <article className="intel-panel">
              <div className="intel-loading">Computing division strength...</div>
            </article>
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
          <h1 className="intel-title">League Intelligence</h1>
          <p className="intel-subtitle">{headline.title}</p>
          <p className="intel-note">{headline.note}</p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">Forecast + playoff + division feeds</div>
        </div>
      </section>

      {error ? <div className="intel-banner intel-banner--warning">{error}</div> : null}

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
              <h2 className="intel-section-title">Forecast Leaderboard</h2>
            </div>
            <div className="intel-section-meta">Top 8 projection scores</div>
          </div>

          {topForecastTeams.length ? (
            <div className="intel-table-wrap">
              <table className="intel-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Conf</th>
                    <th>Div</th>
                    <th>Win %</th>
                    <th>Proj Wins</th>
                    <th>Remain</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topForecastTeams.map((team, index) => (
                    <tr key={team.code}>
                      <td>{String(index + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="intel-team">
                          <span className="intel-team__code">{team.code}</span>
                          <span className="intel-team__name">{team.name}</span>
                        </div>
                      </td>
                      <td>{team.conference}</td>
                      <td>{team.division}</td>
                      <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                      <td>{team.projectedWins}</td>
                      <td>{team.remainingGames}</td>
                      <td>
                        <span className="intel-badge intel-badge--accent">
                          {team.projectionScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            emptyState("Forecast data is not available yet.")
          )}
        </article>

        <div className="intel-stack">
          <article className="intel-panel">
            <div className="intel-panel__header">
              <div>
                <div className="intel-section-kicker">Pressure Board</div>
                <h2 className="intel-section-title">Playoff Pulse</h2>
              </div>
            </div>

            {topPlayoffTeams.length ? (
              <div className="intel-rank-list">
                {topPlayoffTeams.map((team, index) => (
                  <div key={team.code} className="intel-rank-row">
                    <div className="intel-rank-row__left">
                      <span className="intel-rank-row__index">{index + 1}</span>
                      <div>
                        <div className="intel-rank-row__name">{team.name}</div>
                        <div className="intel-rank-row__meta">
                          {team.conference} · {team.division}
                        </div>
                      </div>
                    </div>
                    <div className="intel-rank-row__right">
                      <span className="intel-badge intel-badge--success">
                        {team.playoffProbability}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              emptyState("Playoff pulse data is not available.")
            )}
          </article>

          <article className="intel-panel">
            <div className="intel-panel__header">
              <div>
                <div className="intel-section-kicker">Division Strength</div>
                <h2 className="intel-section-title">Strongest Divisions</h2>
              </div>
            </div>

            {strongestDivisions.length ? (
              <div className="intel-rank-list">
                {strongestDivisions.map((division, index) => (
                  <div
                    key={`${division.conference}-${division.division}`}
                    className="intel-rank-row"
                  >
                    <div className="intel-rank-row__left">
                      <span className="intel-rank-row__index">{index + 1}</span>
                      <div>
                        <div className="intel-rank-row__name">
                          {division.conference} · {division.division}
                        </div>
                        <div className="intel-rank-row__meta">
                          Leader {division.leader?.code || "--"} · Avg Win%{" "}
                          {((division.averageWinPct || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="intel-rank-row__right">
                      <span className="intel-badge intel-badge--neutral">
                        TSI {division.averageTSI}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              emptyState("Division strength data is not available.")
            )}
          </article>
        </div>
      </section>

      <section className="intel-grid intel-grid--support">
        <article className="intel-panel">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Conference Leaders</div>
              <h2 className="intel-section-title">Current Top Seeds</h2>
            </div>
          </div>

          {conferenceLeaders.length ? (
            <div className="intel-rank-list">
              {conferenceLeaders.map((entry) => (
                <div key={entry.conference} className="intel-rank-row">
                  <div className="intel-rank-row__left">
                    <div>
                      <div className="intel-rank-row__name">{entry.conference}</div>
                      <div className="intel-rank-row__meta">
                        {entry.leader?.name || "--"} · {entry.leader?.code || "--"}
                      </div>
                    </div>
                  </div>
                  <div className="intel-rank-row__right">
                    <span className="intel-badge intel-badge--neutral">
                      {entry.leader ? `${((entry.leader.record?.winPct || 0) * 100).toFixed(1)}%` : "--"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            emptyState("Conference leader data is not available.")
          )}
        </article>

        <article className="intel-panel">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">Readout</div>
              <h2 className="intel-section-title">League Summary</h2>
            </div>
          </div>

          <div className="intel-summary-list">
            <div className="intel-summary-item">
              <span className="intel-summary-item__label">Forecast leader</span>
              <span className="intel-summary-item__value">
                {topForecastTeams[0]?.name || "--"}
              </span>
            </div>
            <div className="intel-summary-item">
              <span className="intel-summary-item__label">Most stable division</span>
              <span className="intel-summary-item__value">
                {strongestDivisions[0]
                  ? `${strongestDivisions[0].conference} ${strongestDivisions[0].division}`
                  : "--"}
              </span>
            </div>
            <div className="intel-summary-item">
              <span className="intel-summary-item__label">Highest playoff pressure</span>
              <span className="intel-summary-item__value">
                {topPlayoffTeams[0]?.name || "--"}
              </span>
            </div>
            <div className="intel-summary-item">
              <span className="intel-summary-item__label">Season scope</span>
              <span className="intel-summary-item__value">{year}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
