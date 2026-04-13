```jsx
const { useEffect, useMemo, useState } = React;

function ConferenceRacePage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    window.api
      .getStandings(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !data.standings) {
          throw new Error("Unable to load conference standings.");
        }
        setStandings(data.standings);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch conference race data.");
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

  const conferenceSummary = useMemo(() => {
    if (!standings) return [];

    return Object.entries(standings).map(([conference, divisions]) => {
      const teams = Object.values(divisions || {}).flat();

      const sortedTeams = [...teams].sort((a, b) => {
        const winPctDiff = (b.record?.winPct || 0) - (a.record?.winPct || 0);
        if (winPctDiff !== 0) return winPctDiff;
        return (b.tsi || 0) - (a.tsi || 0);
      });

      const leader = sortedTeams[0] || null;
      const topTeams = sortedTeams.slice(0, 5);

      const averageTSI =
        teams.length > 0
          ? (
              teams.reduce((sum, team) => sum + (Number(team.tsi) || 0), 0) /
              teams.length
            ).toFixed(1)
          : "--";

      const averageWinPct =
        teams.length > 0
          ? (
              (teams.reduce((sum, team) => sum + (Number(team.record?.winPct) || 0), 0) /
                teams.length) *
              100
            ).toFixed(1)
          : "--";

      return {
        conference,
        divisions,
        teamCount: teams.length,
        leader,
        topTeams,
        averageTSI,
        averageWinPct,
      };
    });
  }, [standings]);

  const summaryStats = useMemo(() => {
    if (!conferenceSummary.length) {
      return [
        { label: "Conferences", value: "--", tone: "neutral" },
        { label: "Teams Tracked", value: "--", tone: "neutral" },
        { label: "Top NFC", value: "--", tone: "accent" },
        { label: "Top AFC", value: "--", tone: "success" },
      ];
    }

    const totalTeams = conferenceSummary.reduce(
      (sum, conference) => sum + (conference.teamCount || 0),
      0
    );

    const nfcLeader =
      conferenceSummary.find((conference) => conference.conference === "NFC")?.leader
        ?.code || "--";

    const afcLeader =
      conferenceSummary.find((conference) => conference.conference === "AFC")?.leader
        ?.code || "--";

    return [
      {
        label: "Conferences",
        value: conferenceSummary.length,
        tone: "neutral",
      },
      {
        label: "Teams Tracked",
        value: totalTeams,
        tone: "neutral",
      },
      {
        label: "Top NFC",
        value: nfcLeader,
        tone: "accent",
      },
      {
        label: "Top AFC",
        value: afcLeader,
        tone: "success",
      },
    ];
  }, [conferenceSummary]);

  const headline = useMemo(() => {
    if (!conferenceSummary.length) {
      return {
        label: "Conference Race",
        title: "Conference standings and wildcard pressure will appear here once the feeds load.",
        note: "Use this page to track both conference races through a single intelligence board.",
      };
    }

    const strongestConference = [...conferenceSummary].sort((a, b) => {
      return Number(b.averageTSI || 0) - Number(a.averageTSI || 0);
    })[0];

    return {
      label: "Race Monitor",
      title: strongestConference?.leader
        ? `${strongestConference.leader.name || strongestConference.leader.code} currently sets the pace in the ${strongestConference.conference} race.`
        : "Conference standings are live.",
      note: strongestConference
        ? `${strongestConference.conference} carries an average TSI of ${strongestConference.averageTSI}, with teams averaging ${strongestConference.averageWinPct}% win rate.`
        : "Division leaders and wildcard contenders update from the latest standings feed.",
    };
  }, [conferenceSummary]);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Conference Race</div>
            <h1 className="intel-title">Loading conference intelligence...</h1>
            <p className="intel-subtitle">
              Pulling NFC and AFC standings, division leaders, and wildcard pressure.
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
            <div className="intel-kicker">Conference Race</div>
            <h1 className="intel-title">Conference intelligence unavailable</h1>
            <p className="intel-subtitle">
              The standings feed could not be loaded for {year}.
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
          <h1 className="intel-title">Conference Race</h1>
          <p className="intel-subtitle">{headline.title}</p>
          <p className="intel-note">{headline.note}</p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">
            NFC + AFC race board
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

      {conferenceSummary.map((conferenceData) => (
        <section key={conferenceData.conference} className="intel-conference-section">
          <section className="intel-grid intel-grid--main">
            <article className="intel-panel intel-panel--primary">
              <div className="intel-panel__header">
                <div>
                  <div className="intel-section-kicker">{conferenceData.conference}</div>
                  <h2 className="intel-section-title">Top Contenders</h2>
                </div>
                <div className="intel-section-meta">
                  {conferenceData.topTeams.length} teams · avg TSI {conferenceData.averageTSI}
                </div>
              </div>

              {conferenceData.topTeams.length ? (
                <div className="intel-table-wrap">
                  <table className="intel-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>Record</th>
                        <th>Win %</th>
                        <th>TSI</th>
                        <th>Point Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conferenceData.topTeams.map((team, index) => (
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
                          <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                          <td>
                            <span className="intel-badge intel-badge--accent">
                              {Number(team.tsi || 0).toFixed(1)}
                            </span>
                          </td>
                          <td>{team.pointDiffPerGame}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="intel-empty">No conference contenders available yet.</div>
              )}
            </article>

            <div className="intel-stack">
              <article className="intel-panel">
                <div className="intel-panel__header">
                  <div>
                    <div className="intel-section-kicker">Leader</div>
                    <h2 className="intel-section-title">Conference Pace Setter</h2>
                  </div>
                </div>

                {conferenceData.leader ? (
                  <div className="intel-rank-list">
                    <div className="intel-rank-row">
                      <div className="intel-rank-row__left">
                        <div>
                          <div className="intel-rank-row__name">
                            {conferenceData.leader.name || conferenceData.leader.code}
                          </div>
                          <div className="intel-rank-row__meta">
                            {conferenceData.leader.code} ·{" "}
                            {conferenceData.leader.record?.wins}-
                            {conferenceData.leader.record?.losses}-
                            {conferenceData.leader.record?.ties}
                          </div>
                        </div>
                      </div>
                      <div className="intel-rank-row__right">
                        <span className="intel-badge intel-badge--success">
                          TSI {Number(conferenceData.leader.tsi || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="intel-empty">No leader available.</div>
                )}
              </article>

              <article className="intel-panel">
                <div className="intel-panel__header">
                  <div>
                    <div className="intel-section-kicker">Conference Snapshot</div>
                    <h2 className="intel-section-title">Summary</h2>
                  </div>
                </div>

                <div className="intel-rank-list">
                  <div className="intel-rank-row">
                    <div className="intel-rank-row__left">
                      <div className="intel-rank-row__name">Teams</div>
                    </div>
                    <div className="intel-rank-row__right">
                      <span className="intel-badge intel-badge--neutral">
                        {conferenceData.teamCount}
                      </span>
                    </div>
                  </div>

                  <div className="intel-rank-row">
                    <div className="intel-rank-row__left">
                      <div className="intel-rank-row__name">Average TSI</div>
                    </div>
                    <div className="intel-rank-row__right">
                      <span className="intel-badge intel-badge--accent">
                        {conferenceData.averageTSI}
                      </span>
                    </div>
                  </div>

                  <div className="intel-rank-row">
                    <div className="intel-rank-row__left">
                      <div className="intel-rank-row__name">Average Win %</div>
                    </div>
                    <div className="intel-rank-row__right">
                      <span className="intel-badge intel-badge--success">
                        {conferenceData.averageWinPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="intel-grid intel-grid--support">
            {Object.entries(conferenceData.divisions || {}).map(([divisionName, teams]) => (
              <article key={`${conferenceData.conference}-${divisionName}`} className="intel-panel">
                <div className="intel-panel__header">
                  <div>
                    <div className="intel-section-kicker">{conferenceData.conference}</div>
                    <h3 className="intel-section-title">{divisionName}</h3>
                  </div>
                  <div className="intel-section-meta">{teams.length} teams</div>
                </div>

                <div className="intel-table-wrap">
                  <table className="intel-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>Win %</th>
                        <th>TSI</th>
                        <th>Point Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <tr key={team.code}>
                          <td>
                            <div className="intel-team">
                              <span className="intel-team__code">{team.code}</span>
                              <span className="intel-team__name">
                                {team.name || team.code}
                              </span>
                            </div>
                          </td>
                          <td>{team.record?.wins}</td>
                          <td>{team.record?.losses}</td>
                          <td>{((team.record?.winPct || 0) * 100).toFixed(1)}%</td>
                          <td>{Number(team.tsi || 0).toFixed(1)}</td>
                          <td>{team.pointDiffPerGame}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </section>
        </section>
      ))}
    </div>
  );
}

window.ConferenceRacePage = ConferenceRacePage;
```
