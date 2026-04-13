function RivalTeamImpactVisual({ year = 2025 }) {
  const [loading, setLoading] = React.useState(true);
  const [rivalImpacts, setRivalImpacts] = React.useState([]);
  const [rankedGames, setRankedGames] = React.useState([]);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [cowboysProb, setCowboysProb] = React.useState(50);
  const [scenario, setScenario] = React.useState(null);

  React.useEffect(() => {
    analyzeRivalImpact();
  }, [year, scenario]);

  const analyzeRivalImpact = async () => {
    try {
      setLoading(true);
      // keep your backend logic unchanged
      const result = await window.api.getRivalImpactVisual(year, scenario);

      setRivalImpacts(result.rivalImpacts || []);
      setRankedGames(result.rankedGames || []);
      setCowboysProb(result.cowboysProb || 50);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-kicker">Rival Intelligence</div>
          <h1 className="intel-title">Analyzing game impact...</h1>
          <p className="intel-subtitle">
            Mapping cross-team playoff dependencies.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Fan Intelligence</div>
          <h1 className="intel-title">Games That Matter</h1>
          <p className="intel-subtitle">
            Which games you should care about — ranked by playoff impact.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{cowboysProb}% Playoff Odds</div>
          <div className="intel-chip intel-chip--muted">{year}</div>
        </div>
      </section>

      {/* CONTROLS */}
      <section className="intel-panel">
        <div className="intel-control-grid">
          <select
            className="intel-select"
            value={scenario || ""}
            onChange={(e) => setScenario(e.target.value || null)}
          >
            <option value="">Baseline</option>
            <option value="strong_rivals">Strong Rivals</option>
            <option value="weak_rivals">Weak Rivals</option>
          </select>

          <button
            className="intel-button intel-button--primary"
            onClick={analyzeRivalImpact}
          >
            Recalculate
          </button>
        </div>
      </section>

      {/* STATS */}
      <section className="intel-stat-row">
        <article className="intel-stat">
          <div className="intel-stat__label">Playoff Odds</div>
          <div className="intel-stat__value">{cowboysProb}%</div>
        </article>

        <article className="intel-stat">
          <div className="intel-stat__label">Tracked Teams</div>
          <div className="intel-stat__value">{rivalImpacts.length}</div>
        </article>

        <article className="intel-stat intel-stat--accent">
          <div className="intel-stat__label">Top Impact Game</div>
          <div className="intel-stat__value">
            {rankedGames[0]?.teamName || "--"}
          </div>
        </article>
      </section>

      {/* MAIN */}
      <section className="intel-grid intel-grid--main">

        {/* GAME FEED */}
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Top Games to Watch</h2>
          </div>

          {rankedGames.length === 0 ? (
            <div className="intel-empty">No games available.</div>
          ) : (
            <div className="intel-feed">
              {rankedGames.slice(0, 8).map((game, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedTeam(game.team)}
                  className={`intel-feed-item ${
                    selectedTeam === game.team ? "active" : ""
                  }`}
                >
                  <div className="intel-feed-rank">#{game.impactRank}</div>

                  <div className="intel-feed-main">
                    <div className="intel-feed-title">
                      {game.teamName} vs {game.opponent}
                    </div>

                    <div className="intel-feed-meta">
                      <span className="intel-badge">{game.tier}</span>
                      <span>Impact: {game.cowboysImpactScore}</span>
                      <span>Win %: {game.winProbability}%</span>
                    </div>
                  </div>

                  <div className="intel-feed-action">
                    <span className="intel-badge intel-badge--danger">
                      Root: {game.recommendedOutcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* DETAIL */}
        <article className="intel-panel">
          <h2 className="intel-section-title">Game Breakdown</h2>

          {!selectedTeam ? (
            <div className="intel-empty">
              Select a game to view deeper analysis.
            </div>
          ) : (
            <div className="intel-stack">

              <div className="intel-badge">{selectedTeam}</div>

              <div className="intel-metric-grid">
                {rivalImpacts
                  .filter((t) => t.team === selectedTeam)
                  .map((t) => (
                    <React.Fragment key={t.team}>
                      <div className="intel-metric-card">
                        <div className="intel-metric-card__label">Impact</div>
                        <div className="intel-metric-card__value">
                          {t.cowboysImpactScore}
                        </div>
                      </div>

                      <div className="intel-metric-card">
                        <div className="intel-metric-card__label">Win %</div>
                        <div className="intel-metric-card__value">
                          {t.winProbability}%
                        </div>
                      </div>

                      <div className="intel-metric-card">
                        <div className="intel-metric-card__label">Urgency</div>
                        <div className="intel-metric-card__value">
                          {t.urgency}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
              </div>

              <div className="intel-story-panel">
                <p>
                  Root for the {selectedTeam} to {rivalImpacts.find(t => t.team === selectedTeam)?.recommendedOutcome}.
                  This outcome maximizes playoff probability leverage.
                </p>
              </div>

            </div>
          )}
        </article>

      </section>

      {/* EXPLANATION */}
      <section className="intel-panel">
        <h2 className="intel-section-title">How This Works</h2>

        <div className="intel-grid intel-grid--support">
          <div className="intel-metric-card">
            <div className="intel-metric-card__label">Impact Score</div>
            <div className="intel-metric-card__value">0–100</div>
          </div>

          <div className="intel-metric-card">
            <div className="intel-metric-card__label">Tier</div>
            <div className="intel-metric-card__value">Rival / Threat</div>
          </div>

          <div className="intel-metric-card">
            <div className="intel-metric-card__label">Urgency</div>
            <div className="intel-metric-card__value">Critical → Medium</div>
          </div>
        </div>
      </section>

    </div>
  );
}

window.RivalTeamImpactVisual = RivalTeamImpactVisual;
