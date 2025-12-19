const {
  fetchCowboysGamesSeasonToDate,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
} = require("./services/espn");

/* ---------------- UTIL (ORIGINAL) ---------------- */

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function logistic(z) {
  return 1 / (1 + Math.exp(-z));
}

/* ---------------- ORIGINAL MODEL ENGINE (EXTENDED) ---------------- */

function modelWinProb(modelType, features) {
  const {
    teamWinPct,
    oppWinPct,
    teamPointDiff,
    oppPointDiff,
    isHome,
    scenarioModifier = 0, // NEW (optional)
  } = features;

  let z = 0;

  // ORIGINAL engines (unchanged)
  if (modelType === "Elo") {
    z =
      1.6 * (teamWinPct - oppWinPct) +
      0.09 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.18 : -0.05);
  }

  if (modelType === "RandomForest") {
    z =
      1.9 * (teamWinPct - oppWinPct) +
      0.07 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.15 : -0.04);
  }

  if (modelType === "LSTM") {
    z =
      1.3 * (teamWinPct - oppWinPct) +
      0.14 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.22 : -0.06);
  }

  // NEW: scenario modifier applied INSIDE probability
  const p = logistic(z) + scenarioModifier;
  return clamp(p, 0.05, 0.95);
}

/* ---------------- ORIGINAL MONTE CARLO (EXTENDED) ---------------- */

function monteCarloSeason({
  wins,
  gamesRemainingProbs,
  iterations = 20000,
}) {
  let playoffHits = 0;
  let totalWins = 0;

  for (let i = 0; i < iterations; i++) {
    let w = wins;

    for (let g = 0; g < gamesRemainingProbs.length; g++) {
      if (Math.random() < gamesRemainingProbs[g]) w++;
    }

    totalWins += w;

    if (w >= 9) playoffHits++;
  }

  return {
    playoffProbability: playoffHits / iterations,
    expectedWins: totalWins / iterations,
  };
}

/* ---------------- MAIN ENTRY (EXTENDED) ---------------- */

async function generateEspnPrediction({
  year,
  modelType = "RandomForest",
  iterations = 20000,     // NEW default
  scenarioModifier = 0,   // NEW
}) {
  const games = await fetchCowboysGamesSeasonToDate(year);
  const record = computeRecordFromGames(games);

  const completed = games.filter((g) => g.completed);
  const remainingGames = games.filter((g) => !g.completed);

  const cowAvg = computeTeamAveragesFromGames("DAL", games);

  const probs = [];

  for (const g of remainingGames) {
    const oppAbbr =
      g.homeTeamAbbr === "DAL" ? g.awayTeamAbbr : g.homeTeamAbbr;

    const oppGames = await fetchTeamGamesSeasonToDate(oppAbbr, year);
    const oppAvg = computeTeamAveragesFromGames(oppAbbr, oppGames);

    const oppCompleted = oppGames.filter((x) => x.completed).length || 1;
    const oppWins = oppGames.filter((x) => {
      if (!x.completed) return false;
      const isHome = x.homeTeamAbbr === oppAbbr;
      return isHome
        ? x.homeScore > x.awayScore
        : x.awayScore > x.homeScore;
    }).length;

    const p = modelWinProb(modelType, {
      teamWinPct: record.winPct || 0.5,
      oppWinPct: oppWins / oppCompleted,
      teamPointDiff: cowAvg.pointDiffPerGame,
      oppPointDiff: oppAvg.pointDiffPerGame,
      isHome: g.homeTeamAbbr === "DAL",
      scenarioModifier, // NEW
    });

    probs.push(p);
  }

  const sim = monteCarloSeason({
    wins: record.wins,
    gamesRemainingProbs: probs,
    iterations,
  });

  return {
    modelUsed: modelType,
    currentRecord: record,
    gamesRemaining: remainingGames.length,
    perGameWinProbabilities: probs.map((p) => Number(p.toFixed(3))),
    expectedWins: Number(sim.expectedWins.toFixed(1)),        // NEW exposed
    playoffProbability: Number(sim.playoffProbability.toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateEspnPrediction,
};



