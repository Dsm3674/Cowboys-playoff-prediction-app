import React from "react";
import { api } from "../api";

function MustWinCard({ year, team = "DAL" }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    api.getMustWin(team, year, 0)
      .then(res => setGames(res.games || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, team]);

  // Always render the card shell so the dashboard grid keeps its shape.
  if (loading) {
    return (
      <div className="card must-win-card">
        <h3 className="must-win-card__title">{team} High Leverage Games</h3>
        <p className="must-win-card__intro text-muted">Ranking the schedule…</p>
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="card must-win-card">
        <h3 className="must-win-card__title">{team} High Leverage Games</h3>
        <p className="must-win-card__intro text-muted">
          No remaining games to rank yet — leverage calls land once the schedule is live.
        </p>
      </div>
    );
  }

  // Take top 3 most important games
  const topGames = games.slice(0, 3);

  return (
    <div className="card must-win-card">
      <h3 className="must-win-card__title">{team} High Leverage Games</h3>
      <p className="must-win-card__intro">
        These matchups have the biggest impact on playoff probability for {team}.
      </p>

      <div className="must-win-card__list">
        {topGames.map((g, i) => (
          <div key={i} className="must-win-card__item">
            <div>
              <div className="must-win-card__opp">vs {g.opp}</div>
              <div className="must-win-card__date">
                {new Date(g.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
              </div>
            </div>
            <div className="must-win-card__meta">
              <div className="must-win-card__badge">
                {(g.swing * 100).toFixed(1)}% Swing
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.MustWinCard = MustWinCard;

export default MustWinCard;
