class PredictionEngine {
  static calculatePrediction(seasonData, gameStats, players) {
    const winPct = seasonData.wins / (seasonData.wins + seasonData.losses);
    
    const offensiveRating = this.calculateOffensiveRating(gameStats);
    const defensiveRating = this.calculateDefensiveRating(gameStats);
    const injuryImpact = this.calculateInjuryImpact(players);
    
    const overallScore = (
      (winPct * 100) * 0.30 +
      offensiveRating * 0.25 +
      defensiveRating * 0.25 +
      (100 + injuryImpact) * 0.20
    );
    
    const playoffProb = Math.min(95, Math.max(5, overallScore * 0.85));
    const divisionProb = Math.min(80, Math.max(3, overallScore * 0.55));
    const conferenceProb = Math.min(45, Math.max(2, overallScore * 0.28));
    const superbowlProb = Math.min(25, Math.max(1, overallScore * 0.15));
    
    return {
      playoffProb: parseFloat(playoffProb.toFixed(2)),
      divisionProb: parseFloat(divisionProb.toFixed(2)),
      conferenceProb: parseFloat(conferenceProb.toFixed(2)),
      superbowlProb: parseFloat(superbowlProb.toFixed(2)),
      confidenceScore: parseFloat((overallScore * 0.9).toFixed(2)),
      factors: {
        offensive_rating: parseFloat(offensiveRating.toFixed(2)),
        defensive_rating: parseFloat(defensiveRating.toFixed(2)),
        injury_impact: injuryImpact,
        win_percentage: parseFloat((winPct * 100).toFixed(2))
      }
    };
  }

  static calculateOffensiveRating(gameStats) {
    const avgPointsScored = parseFloat(gameStats.avg_points_scored);
    const avgTotalYards = parseFloat(gameStats.avg_total_yards);
    const avgTurnovers = parseFloat(gameStats.avg_turnovers);
    
    const pointsScore = Math.min(100, (avgPointsScored / 35) * 100);
    const yardsScore = Math.min(100, (avgTotalYards / 400) * 100);
    const turnoverPenalty = avgTurnovers * 5;
    
    return Math.max(0, (pointsScore * 0.6 + yardsScore * 0.4) - turnoverPenalty);
  }

  static calculateDefensiveRating(gameStats) {
    const avgPointsAllowed = parseFloat(gameStats.avg_points_allowed);
    const defensiveScore = Math.max(0, 100 - (avgPointsAllowed / 30) * 100);
    return Math.min(100, defensiveScore);
  }

  static calculateInjuryImpact(players) {
    let impact = 0;
    players.forEach(player => {
      if (player.injury_status === 'Injured') {
        impact -= player.performance_rating > 85 ? 8 : 4;
      } else if (player.injury_status === 'Questionable') {
        impact -= player.performance_rating > 85 ? 4 : 2;
      }
    });
    return Math.max(-20, impact);
  }
}

module.exports = PredictionEngine;