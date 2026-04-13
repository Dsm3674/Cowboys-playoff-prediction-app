const { useEffect, useState, useMemo } = React;

function DetailedTeamProfilePage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [record, setRecord] = useState(null);
  const [tsi, setTsi] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [mustWin, setMustWin] = useState([]);
  const [paths, setPaths] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    Promise.allSettled([
      window.api.getRecord(year, selectedTeam),
      window.api.getTSI(selectedTeam, year),
      window.api.getSchedule(year, selectedTeam),
      window.api.getMustWin(selectedTeam, year),
      window.api.getPaths(selectedTeam, year, 12, 0)
    ])
      .then((results) => {
        if (cancelled) return;

        const [r, t, s, m, p] = results;

        if (r.status === "fulfilled") setRecord(r.value);
        if (t.status === "fulfilled") setTsi(t.value);
        if (s.status === "fulfilled") setSchedule(s.value.games || []);
        if (m.status === "fulfilled") setMustWin(m.value.games || []);
        if (p.status === "fulfilled") setPaths(p.value);

        if (results.some(x => x.status === "rejected")) {
          setError("Some team profile data could not be loaded.");
        }
      })
      .catch((err) => setError(err?.message || "Failed to load profile data."))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [year, selectedTeam]);

  const upcoming = useMemo(() => schedule.filter(g => !g.completed).slice(0, 5), [schedule]);
  const topMustWin = useMemo(() => mustWin.slice(0, 3), [mustWin]);
  const pathRows = useMemo(() => (paths?.paths || []).slice(0, 5), [paths]);

  const headline = useMemo(() => {
    if (!record) return "Team snapshot unavailable.";

    return `${selectedTeam} sits at ${record.wins}-${record.losses}-${record.ties}, with playoff viability driven by remaining schedule and path volatility.`;
  }, [record, selectedTeam]);

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div>
            <div className="intel-kicker">Team Intelligence</div>
            <h1 className="intel-title">Loading {selectedTeam} profile...</h1>
            <p className="intel-subtitle">Pulling record, schedule, and simulation data.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Team Intelligence</div>
          <h1 className="intel-title">{selectedTeam} Dossier</h1>
          <p className="intel-subtitle">{headline}</p>
          <p className="intel-note">
            Full breakdown of performance, schedule pressure, and projected paths.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">Live Analytics Feed</div>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="intel-banner intel-banner--warning">{error}</div>
      )}

      {/* STATS */}
      <section className="intel-stat-row">

        <article className="intel-stat intel-stat--accent">
          <div className="intel-stat__label">Record</div>
          <div className="intel-stat__value">
            {record ? `${record.wins}-${record.losses}-${record.ties}` : "--"}
          </div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Win %</div>
          <div className="intel-stat__value">
            {record?.winPct ? `${(record.winPct * 100).toFixed(1)}%` : "--"}
          </div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">TSI</div>
          <div className="intel-stat__value">
            {tsi?.tsi ?? "--"}
          </div>
        </article>

        <article className="intel-stat intel-stat--success">
          <div className="intel-stat__label">Path Confidence</div>
          <div className="intel-stat__value">
            {paths?.paths?.[0]?.probability
              ? `${(paths.paths[0].probability * 100).toFixed(1)}%`
              : "--"}
          </div>
        </article>

      </section>

      {/* MAIN GRID */}
      <section className="intel-grid intel-grid--main">

        {/* UPCOMING */}
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Upcoming Schedule</h2>
          </div>

          {upcoming.length ? (
            <div className="intel-stack">
              {upcoming.map((game, i) => (
                <div key={i} className="intel-row">
                  <div>
                    <div className="intel-row__title">
                      {game.homeTeamAbbr === selectedTeam ? "vs" : "@"}{" "}
                      {game.homeTeamAbbr === selectedTeam
                        ? game.awayTeamAbbr
                        : game.homeTeamAbbr}
                    </div>
                    <div className="intel-row__meta">
                      {new Date(game.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="intel-badge">{game.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="intel-empty">No upcoming games.</div>
          )}
        </article>

        {/* MUST WIN */}
        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Must-Win Games</h2>
          </div>

          {topMustWin.length ? (
            <div className="intel-stack">
              {topMustWin.map((game, i) => (
                <div key={i} className="intel-row">
                  <div>
                    <div className="intel-row__title">vs {game.opp}</div>
                    <div className="intel-row__meta">
                      {new Date(game.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="intel-badge intel-badge--danger">
                    {(game.swing * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="intel-empty">No high-leverage games.</div>
          )}
        </article>

      </section>

      {/* PATH TABLE */}
      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Projected Season Paths</h2>
        </div>

        {pathRows.length ? (
          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Probability</th>
                  <th>Wins Added</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {pathRows.map((path, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{(path.probability * 100).toFixed(1)}%</td>
                    <td>{path.winsAdded}</td>
                    <td>{(path.outcomes || []).map(o => o.result).join("-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="intel-empty">No path simulations available.</div>
        )}
      </section>

    </div>
  );
}

window.DetailedTeamProfilePage = DetailedTeamProfilePage;
