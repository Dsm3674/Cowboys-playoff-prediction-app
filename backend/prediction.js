const {
  fetchCowboysGamesSeasonToDate,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
} = require("./services/espn");

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function logistic(z) {
  return 1 / (1 + Math.exp(-z));
}

function applyChaos(p, chaos = 0) {
  const c = clamp(Number(chaos) || 0, 0, 1);
  let mixed = (1 - c) * p + c * 0.5;
  const jitter = (Math.random() - 0.5) * 0.22 * c;
  mixed += jitter;
  return clamp(mixed, 0.05, 0.95);
}

function modelWinProb(modelType, features) {
  const {
    teamWinPct,
    oppWinPct,
    teamPointDiff,
    oppPointDiff,
    isHome,
    scenarioModifier,
  } = features;

  let z = 0;

  if (modelType === "RandomForest") {
    z =
      1.8 * (teamWinPct - oppWinPct) +
      0.08 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.25 : -0.05);
  } else if (modelType === "LogisticRegression") {
    z =
      2.2 * (teamWinPct - oppWinPct) +
      0.06 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.2 : 0);
  } else {
    z =
      1.6 * (teamWinPct - oppWinPct) +
      0.05 * (teamPointDiff - oppPointDiff);
  }

  z += scenarioModifier || 0;

  return clamp(logistic(z), 0.05, 0.95);
}

function monteCarloSeason(currentWins, remainingProbs, iterations) {
  let playoffCount = 0;
  let totalWins = 0;

  for (let i = 0; i < iterations; i++) {
    let wins = currentWins;

    for (const p of remainingProbs) {
      if (Math.random() < p) wins++;
    }

    totalWins += wins;
    if (wins >= 10) playoffCount++;
  }

  return {
    playoffProbability: playoffCount / iterations,
    expectedWins: totalWins / iterations,
  };
}

async function generateEspnPrediction({
  year,
  modelType = "RandomForest",
  iterations = 20000,
  scenarioModifier = 0,
  chaos = 0,
}) {
  const cowboysGames = await fetchCowboysGamesSeasonToDate(year);
  const record = computeRecordFromGames(cowboysGames);
  const cowAvg = computeTeamAveragesFromGames("DAL", cowboysGames);

  const remaining = cowboysGames.filter((g) => !g.completed);

  const probs = [];

  for (const g of remaining) {
    const oppAbbr =
      g.homeTeamAbbr === "DAL" ? g.awayTeamAbbr : g.homeTeamAbbr;

    const oppGames = await fetchTeamGamesSeasonToDate(oppAbbr, year);
    const oppRecord = computeRecordFromGames(oppGames);
    const oppAvg = computeTeamAveragesFromGames(oppAbbr, oppGames);

    const pBase = modelWinProb(modelType, {
      teamWinPct: record.winPct || 0.5,
      oppWinPct: oppRecord.winPct || 0.5,
      teamPointDiff: cowAvg.pointDiffPerGame || 0,
      oppPointDiff: oppAvg.pointDiffPerGame || 0,
      isHome: g.homeTeamAbbr === "DAL",
      scenarioModifier,
    });

    const p = applyChaos(pBase, chaos);
    probs.push(p);
  }

  const sim = monteCarloSeason(record.wins, probs, iterations);

  return {
    playoffProbability: sim.playoffProbability,
    expectedWins: sim.expectedWins,
    gamesRemaining: remaining.length,
    modelUsed: modelType,
    generatedAt: new Date().toISOString(),
    perGameWinProbabilities: probs,
  };
}

module.exports = { generateEspnPrediction };



