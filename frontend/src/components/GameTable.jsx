import React from "react";
import { api } from "../api";

function GameTable({ year, team = "DAL" }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    api
      .getSchedule(year, team)
      .then((data) => {
        if (cancelled) return;
        setGames(Array.isArray(data?.games) ? data.games : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load schedule.");
          setGames([]);
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
  }, [year, team]);

  const upcomingGames = React.useMemo(
    () => games.filter((game) => !game.completed).length,
    [games]
  );

  const completedGames = React.useMemo(
    () => games.filter((game) => game.completed).length,
    [games]
  );

  if (loading) {
    return (
      <div className="intel-panel">
        <div className="intel-section-kicker">Schedule Feed</div>
        <h2 className="intel-section-title">{team} Schedule</h2>
        <div className="intel-empty">Loading schedule intelligence...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-panel">
        <div className="intel-section-kicker">Schedule Feed</div>
        <h2 className="intel-section-title">{team} Schedule</h2>
        <div className="intel-banner intel-banner--warning">{error}</div>
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="intel-panel">
        <div className="intel-section-kicker">Schedule Feed</div>
        <h2 className="intel-section-title">{team} Schedule</h2>
        <div className="intel-empty">No games found for {year}.</div>
      </div>
    );
  }

  return (
    <div className="intel-panel">
      <div className="intel-panel__header">
        <div>
          <div className="intel-section-kicker">Schedule Feed</div>
          <h2 className="intel-section-title">{team} Schedule</h2>
        </div>
        <div className="intel-hero__meta">
          <div className="intel-chip">{year}</div>
          <div className="intel-chip intel-chip--muted">
            {completedGames} complete / {upcomingGames} upcoming
          </div>
        </div>
      </div>

      <div className="intel-table-wrap">
        <table className="intel-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Matchup</th>
              <th>Status</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            {games.map((game, index) => {
              const isHomeTeam = game.homeTeamAbbr === team || game.homeTeamName === team;
              const opponentCode = isHomeTeam
                ? game.awayTeamAbbr || game.awayTeamName
                : game.homeTeamAbbr || game.homeTeamName;

              const opponentName = isHomeTeam
                ? game.awayTeamName || opponentCode
                : game.homeTeamName || opponentCode;

              const gameDate = game.date
                ? new Date(game.date).toLocaleDateString()
                : "TBD";

              const statusText = game.completed
                ? "Final"
                : game.status || "Scheduled";

              const scoreText =
                game.homeScore != null && game.awayScore != null
                  ? `${game.homeScore} - ${game.awayScore}`
                  : "—";

              return (
                <tr key={game.id || `${team}-${index}`}>
                  <td>{gameDate}</td>
                  <td>
                    <div className="intel-team">
                      <span
                        className={`intel-team__code intel-team__code--${
                          isHomeTeam ? "home" : "away"
                        }`}
                      >
                        {isHomeTeam ? "vs" : "@"}
                      </span>
                      <span className="intel-team__name">{opponentName}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`intel-badge ${
                        game.completed
                          ? "intel-badge--neutral"
                          : "intel-badge--accent"
                      }`}
                    >
                      {statusText}
                    </span>
                  </td>
                  <td>{scoreText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.GameTable = GameTable;

export default GameTable;
