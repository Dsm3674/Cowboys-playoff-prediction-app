const {
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames,
} = require("./services/espn");



function getWinProbFromModel(model, stats) {
  const { avgFor, avgAgainst } = stats;
  const diff = avgFor - avgAgainst;

  if (model === "Elo") {
    return Math.max(0.25, Math.min(0.75, 0.5 + diff * 0.025));
  }

  if (model === "RandomForest") {
    return Math.max(0.3, Math.min(0.75, 0.52 + diff * 0.03));
  }

  if (model === "LSTM") {
    // more volatile
    return Math.max(0.2, Math.min(0.8, 0.5 + diff * 0.04));
  }

  return 0.5;
}



function monteCarloSeason({
  wins,
  losses,
  ties,
  gamesRemaining,
  winProb,
  iterations = 20000,
}) {
  let playoffHits = 0;
  let totalWins = 0;

  for (let i = 0; i < iterations; i++) {
    let w = wins;

    for (let g = 0; g < gamesRemaining; g++) {
      if (Math.random() < winProb) w++;
    }

    totalWins += w;

    // NFC playoff baseline
    if (w >= 9) playoffHits++;
  }

  return {
    playoffProbability: playoffHits / iterations,
    expectedWins: totalWins / iterations,
  };
}

/* ---------------- MAIN ENTRY ---------------- */

async function generateEspnPrediction({ year, modelType }) {
  const games = await fetchCowboysGamesSeasonToDate(year);
  const record = computeRecordFromGames(games);

  const completed = games.filter((g) => g.completed);
  const remaining = games.length - completed.length;

  let pf = 0;
  let pa = 0;

  completed.forEach((g) => {
    const home = g.homeTeamAbbr === "DAL";
    pf += home ? g.homeScore : g.awayScore;
    pa += home ? g.awayScore : g.homeScore;
  });

  const avgFor = completed.length ? pf / completed.length : 21;
  const avgAgainst = completed.length ? pa / completed.length : 21;

  const winProb = getWinProbFromModel(modelType, {
    avgFor,
    avgAgainst,
  });

  const sim = monteCarloSeason({
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    gamesRemaining: remaining,
    winProb,
  });

  return {
    modelUsed: modelType,
    currentRecord: record,
    gamesRemaining: remaining,
    winProbabilityPerGame: Number(winProb.toFixed(3)),
    projectedWins: Number(sim.expectedWins.toFixed(1)),
    playoffProbability: Number(sim.playoffProbability.toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateEspnPrediction,
};

