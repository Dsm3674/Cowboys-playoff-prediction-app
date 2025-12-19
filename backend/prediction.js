const {
  fetchCowboysGamesSeasonToDate,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
} = require("./services/espn");

/* ---------------- MODEL ENGINES ---------------- */

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function logistic(z) {
  return 1 / (1 + Math.exp(-z));
}

function eloWinProb(teamElo, oppElo, homeAdv = 55) {
  // classic Elo expected score
  const diff = (teamElo + homeAdv) - oppElo;
  const p = 1 / (1 + Math.pow(10, -diff / 400));
  return clamp(p, 0.1, 0.9);
}

function buildTeamRatingFromESPN({ winPct, pointDiffPerGame }) {
  // light-weight rating (not “trained”, just consistent + ESPN-based)
  // 1500 baseline, win% shifts, point diff shifts
  return (
    1500 +
    (winPct - 0.5) * 400 +
    clamp(pointDiffPerGame, -20, 20) * 12
  );
}

function modelWinProb(modelType, features) {
  const {
    teamWinPct,
    oppWinPct,
    teamPointDiff,
    oppPointDiff,
    isHome,
  } = features;

  // Home bump as probability-ish (varies by engine)
  const homeBump = isHome ? 0.03 : -0.01;

  if (modelType === "Elo") {
    const teamElo = buildTeamRatingFromESPN({
      winPct: teamWinPct,
      pointDiffPerGame: teamPointDiff,
    });
    const oppElo = buildTeamRatingFromESPN({
      winPct: oppWinPct,
      pointDiffPerGame: oppPointDiff,
    });
    // Elo handles home via eloWinProb’s homeAdv
    return eloWinProb(teamElo, oppElo, isHome ? 55 : 0);
  }

  if (modelType === "RandomForest") {
    // “RF style”: more conservative, less swingy
    const z =
      1.8 * (teamWinPct - oppWinPct) +
      0.08 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.18 : -0.05);
    return clamp(logistic(z) + homeBump, 0.12, 0.88);
  }

  if (modelType === "LSTM") {
    // “LSTM style”: more reactive to point diff momentum (more volatile)
    const z =
      1.4 * (teamWinPct - oppWinPct) +
      0.14 * (teamPointDiff - oppPointDiff) +
      (isHome ? 0.22 : -0.06);
    return clamp(logistic(z) + homeBump, 0.08, 0.92);
  }

  // fallback
  return 0.5;
}

/* ---------------- MONTE CARLO ---------------- */

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

    // simple playoff baseline
    if (w >= 9) playoffHits++;
  }

  return {
    playoffProbability: playoffHits / iterations,
    expectedWins: totalWins / iterations,
  };
}

/* ---------------- MAIN ENTRY ---------------- */

async function generateEspnPrediction({ year, modelType = "RandomForest" }) {
  const games = await fetchCowboysGamesSeasonToDate(year);
  const record = computeRecordFromGames(games);

  const completed = games.filter((g) => g.completed);
  const remainingGames = games.filter((g) => !g.completed);

  // Cowboys season-to-date averages from ESPN schedule results
  const cowAvg = computeTeamAveragesFromGames("DAL", games);

  // Cache opponents so we don’t refetch same team multiple times
  const oppCache = new Map();

  async function getOpponentSummary(oppAbbr) {
    const abbr = String(oppAbbr || "").toUpperCase();
    if (oppCache.has(abbr)) return oppCache.get(abbr);

    const oppGames = await fetchTeamGamesSeasonToDate(abbr, year);
    const oppRec = computeRecordFromGames(
      // computeRecordFromGames assumes DAL, so we can’t use it directly
      // We'll compute winPct ourselves for opponent:
      // easiest: reuse computeTeamAverages + manual record calc:
      // but record calc is DAL-specific, so do custom here.
      []
    );

    // custom opponent record calc
    let w = 0, l = 0, t = 0;
    oppGames.forEach((g) => {
      if (!g.completed) return;
      if (g.homeScore === g.awayScore) { t++; return; }
      const isHome = (g.homeTeamAbbr || "").toUpperCase() === abbr;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      if (teamScore > oppScore) w++; else l++;
    });

    const total = w + l + t;
    const winPct = total ? w / total : 0.5;
    const avgs = computeTeamAveragesFromGames(abbr, oppGames);

    const summary = {
      wins: w,
      losses: l,
      ties: t,
      winPct,
      avgFor: avgs.avgFor,
      avgAgainst: avgs.avgAgainst,
      pointDiffPerGame: avgs.pointDiffPerGame,
    };

    oppCache.set(abbr, summary);
    return summary;
  }

  // Build per-game win probs (this is what makes models feel different)
  const probs = [];
  for (const g of remainingGames) {
    const oppAbbr =
      (g.homeTeamAbbr || "").toUpperCase() === "DAL"
        ? (g.awayTeamAbbr || "").toUpperCase()
        : (g.homeTeamAbbr || "").toUpperCase();

    const isHome = (g.homeTeamAbbr || "").toUpperCase() === "DAL";
    const opp = await getOpponentSummary(oppAbbr);

    const p = modelWinProb(modelType, {
      teamWinPct: record.winPct ?? (completed.length ? record.wins / completed.length : 0.5),
      oppWinPct: opp.winPct,
      teamPointDiff: cowAvg.pointDiffPerGame,
      oppPointDiff: opp.pointDiffPerGame,
      isHome,
    });

    probs.push(p);
  }

  const sim = monteCarloSeason({
    wins: record.wins,
    gamesRemainingProbs: probs,
    iterations: 20000,
  });

  const avgP =
    probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 0.5;

  return {
    modelUsed: modelType,
    currentRecord: record,
    gamesRemaining: remainingGames.length,
    perGameWinProbabilities: probs.map((p) => Number(p.toFixed(3))),
    winProbabilityPerGameAvg: Number(avgP.toFixed(3)),
    projectedWins: Number(sim.expectedWins.toFixed(1)),
    playoffProbability: Number(sim.playoffProbability.toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateEspnPrediction,
};


