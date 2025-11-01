class PredictionEngine {
  static calculatePrediction(seasonData, gameStats) {
    const { wins, losses, ties = 0 } = seasonData;
    const gamesPlayed = wins + losses + ties;
    const winPct = gamesPlayed > 0 ? wins / gamesPlayed : 0;

    const {
      avg_points_scored,
      avg_total_yards,
      avg_points_allowed,
      avg_turnovers,
    } = gameStats;

    const offenseScore =
      Math.min(100, (avg_points_scored / 35) * 60 + (avg_total_yards / 400) * 40);
    const defenseScore = Math.max(0, 100 - (avg_points_allowed / 30) * 100);
    const turnoverScore = Math.max(0, 100 - avg_turnovers * 10);
    const momentumScore = winPct >= 0.6 ? 90 : winPct >= 0.5 ? 75 : 50;

    const baseScore =
      winPct * 100 * 0.35 +
      offenseScore * 0.25 +
      defenseScore * 0.20 +
      turnoverScore * 0.10 +
      momentumScore * 0.10;

    const finalScore = Math.min(100, Math.max(0, baseScore));

    const playoffProb = Math.round(finalScore * 0.95 * 10) / 10;
    const divisionProb = Math.round(finalScore * 0.65 * 10) / 10;
    const conferenceProb = Math.round(finalScore * 0.35 * 10) / 10;
    const superbowlProb = Math.round(finalScore * 0.15 * 10) / 10;
    const confidenceScore = Math.round(finalScore * 0.9 * 10) / 10;

    return {
      playoff_probability: playoffProb,
      division_probability: divisionProb,
      conference_probability: conferenceProb,
      superbowl_probability: superbowlProb,
      confidence_score: confidenceScore,
      factors: {
        win_percentage: +(winPct * 100).toFixed(2),
        offensive_efficiency: +offenseScore.toFixed(2),
        defensive_efficiency: +defenseScore.toFixed(2),
        turnover_discipline: +turnoverScore.toFixed(2),
        momentum: +momentumScore.toFixed(2),
        base_score: +finalScore.toFixed(2),
      },
    };
  }
}

module.exports = PredictionEngine;
