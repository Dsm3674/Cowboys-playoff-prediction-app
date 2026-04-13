const { useEffect, useMemo, useState } = React;

function ScheduleStrengthPage({ year = new Date().getFullYear() }) {
  const [scheduleStrength, setScheduleStrength] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    window.api
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

  const headline = useMemo(() => {
    if (!scheduleStrength.length) {
      return {
        label: "Schedule Strength",
        title: "Remaining schedule difficulty will appear once data is available.",
        note: "Use this board to identify teams with tough finishes vs easy closing runs.",
      };
    }

    const toughest = scheduleStrength[0];
    const easiest = scheduleStrength[scheduleStrength.length - 1];

    return {
      label: "Schedule Strength",
      title: `${toughest.code} faces the toughest remaining schedule, while ${easiest.code} has the easiest path forward.`,
      note: `${toughest.code} opponents average ${toughest.averageOpponentTsi} TSI across ${toughest.remainingGames} games.`,
    };
  }, [scheduleStrength]);

  const summaryStats = useMemo(() => {
    if (!scheduleStrength.length) {
      return [
        { label: "Teams", value: "--", tone: "neutral" },
        { label: "Toughest", value: "--", tone: "danger" },
        { label: "Easiest", value: "--", tone: "success" },
        { label: "Avg Opp TSI", value: "--", tone: "neutral" },
      ];
    }

    const toughest = scheduleStrength[0];
    const easiest = scheduleStrength[scheduleStrength.length - 1];

    const avgTSI = (
      scheduleStrength.reduce(
        (sum, t) => sum + (Number(t.averageOpponentTsi) || 0),
        0
      ) / scheduleStrength.length
    ).toFixed(1);

    return [
      { label: "Teams", value: scheduleStrength.length, tone: "neutral" },
      { label: "Toughest", value: toughest.code, tone: "danger" },
      { label: "Easiest", value: easiest.code, tone: "success" },
      { label: "Avg Opp TSI", value: avgTSI, tone: "neutral" },
    ];
  }, [scheduleStrength]);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Schedule Strength</div>
            <h1 className="intel-title">Evaluating remaining slates...</h1>
            <p className="intel-subtitle">
              Calculating opponent difficulty across the league for {year}.
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
            <div className="intel-kicker">Schedule Strength</div>
            <h1 className="intel-title">Schedule board unavailable</h1>
            <p className="intel-subtitle">
              Failed to load remaining schedule data.
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
          <h1 className="intel-title">Schedule Strength</h1>
          <p className="intel-subtitle">{headline.title}</p>
          <p className="intel-note">{headline.note}</p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">
            Remaining schedule analysis
          </div>
        </div>
      </section>

      <section className="intel-stat-row">
        {summaryStats.map((stat) => (
          <article
            key={stat.label}
            className={`intel-stat intel-stat--${stat.tone}`}
          >
            <div className="intel-stat__label">{stat.label}</div>
            <div className="intel-stat__value">{stat.value}</div>
          </article>
        ))}
      </section>

      <section className="intel-grid intel-grid--main">
        {/* TOP TABLE */}
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <div>
              <div className="intel-section-kicker">League Ranking</div>
              <h2 className="intel-section-title">
                Toughest Remaining Schedules
              </h2>
            </div>
            <div className="intel-section-meta">
              Sorted by difficulty
            </div>
          </div>

          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Strength</th>
                  <th>Remaining</th>
                  <th>Avg Opp TSI</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {scheduleStrength.map((team, index) => (
                  <tr key={team.code}>
                    <td>{String(index + 1).padStart(2, "0")}</td>
                    <td>
                      <div className="intel-team">
                        <span className="intel-team__code">{team.code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="intel-badge intel-badge--danger">
                        {team.strengthScore}
                      </span>
                    </td>
                    <td>{team.remainingGames}</td>
                    <td>{team.averageOpponentTsi}</td>
                    <td>
                      {team.record?.wins}-{team.record?.losses}-
                      {team.record?.ties}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* QUICK INSIGHT */}
        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Key Signal</h2>
          </div>

          <div className="intel-stack">
            <div className="intel-story-panel">
              Teams at the top of this list face significantly stronger
              opponents, increasing volatility in playoff projections.
              Lower-ranked teams may benefit from easier closing schedules.
            </div>
          </div>
        </article>
      </section>

      {/* TEAM BREAKDOWN */}
      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Remaining Games by Team</h2>
        </div>

        <div className="intel-grid intel-grid--support">
          {scheduleStrength.map((team) => (
            <article key={team.code} className="intel-panel">
              <div className="intel-panel__header">
                <div>
                  <div className="intel-section-kicker">{team.code}</div>
                  <h3 className="intel-section-title">
                    {team.remainingGames} Games Left
                  </h3>
                </div>
              </div>

              <div className="intel-stack">
                {team.remainingSchedule.map((game, index) => (
                  <div key={index} className="intel-row">
                    <div>
                      <div className="intel-row__title">
                        vs {game.opponent}
                      </div>
                      <div className="intel-row__meta">
                        {game.date
                          ? new Date(game.date).toLocaleDateString()
                          : "TBD"}
                      </div>
                    </div>
                    <div className="intel-badge">
                      {game.location}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

window.ScheduleStrengthPage = ScheduleStrengthPage;
