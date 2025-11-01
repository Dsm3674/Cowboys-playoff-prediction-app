/**
 * PredictionEngine — estimates Cowboys playoff/division/conference/Super Bowl chances
 * based on record and performance stats from ESPN.
 */

const PredictionEngine = {
  calculatePrediction(record, stats) {
    // --- Extract key metrics ---
    const totalGames = record.wins + record.losses + record.ties;
    const winRate = totalGames > 0 ? record.wins / totalGames : 0.5;

    // Points differential = how much more the Cowboys score than allow
    const pointsDiff =
      (stats.avg_points_scored || 0) - (stats.avg_points_allowed || 0);

    // Normalize the differential effect (-10 → +10 range roughly)
    const diffFactor = Math.max(-10, Math.min(pointsDiff, 10)) / 10;

    // Create a "team strength" metric combining win rate + performance
    const teamStrength = Math.min(Math.max(winRate + diffFactor * 0.25, 0), 1);

    // --- Compute chances (fractions 0–1, NOT percentages) ---
    const playoffChance = Math.min(0.1 + teamStrength * 0.8, 0.98);
    const divisionChance = Math.min(0.05 + teamStrength * 0.7, 0.85);
    const conferenceChance = Math.min(0.02 + teamStrength * 0.5, 0.65);
    const superBowlChance = Math.min(0.01 + teamStrength * 0.25, 0.4);

    // --- Round and build prediction object ---
    const prediction = {
      playoffs: Number(playoffChance.toFixed(3)),
      division: Number(divisionChance.toFixed(3)),
      conference: Number(conferenceChance.toFixed(3)),
      superBowl: Number(superBowlChance.toFixed(3)),

      // Add timestamp for UI (fixes "Invalid Date")
      generatedAt: new Date().toISOString(),
    };

    return prediction;
  },
};

module.exports = PredictionEngine;

