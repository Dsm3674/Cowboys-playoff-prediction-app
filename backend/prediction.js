const {
  fetchCowboysGamesSeasonToDate,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
} = require("./services/espn");
const {
  getEloSnapshot,
  blendWithElo,
  eloWinProb,
  powerForGame,
  nextGameOf,
  ELO_HOME_FIELD,
} = require("./services/ratingsEngine");
const { getSeasonSimulation, playoffCurve } = require("./services/seasonSimulator");
const { projectPlayoffProbability } = require("./seasonPath");

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

/**
 * Win totals from the per-game probabilities, mapped to playoff odds through
 * the team's simulated playoff-by-wins curve (its division and tiebreak
 * context) rather than a flat 10-win cutoff.
 */
function monteCarloSeason(currentWins, remainingProbs, iterations, curve = null) {
  let playoffSum = 0;
  let totalWins = 0;

  for (let i = 0; i < iterations; i++) {
    let wins = currentWins;

    for (const p of remainingProbs) {
      if (Math.random() < p) wins++;
    }

    totalWins += wins;
    playoffSum += projectPlayoffProbability(wins, curve);
  }

  return {
    playoffProbability: playoffSum / iterations,
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
  const [cowboysGames, eloSnap, leagueSim] = await Promise.all([
    fetchCowboysGamesSeasonToDate(year),
    getEloSnapshot({ year }),
    getSeasonSimulation({ year }).catch(() => null),
  ]);
  const dalSim = leagueSim?.teams.find((t) => t.code === "DAL") || null;
  // Cowboys record is fine at default "DAL"
  const record = computeRecordFromGames(cowboysGames, "DAL");
  const cowAvg = computeTeamAveragesFromGames("DAL", cowboysGames);

  const remaining = cowboysGames.filter((g) => !g.completed);
  const nextGame = nextGameOf(remaining);

  const probs = [];

  for (const g of remaining) {
    const oppAbbr =
      (g.homeTeamAbbr || "").toUpperCase() === "DAL"
        ? g.awayTeamAbbr
        : g.homeTeamAbbr;

    const oppGames = await fetchTeamGamesSeasonToDate(oppAbbr, year);
   
    const oppRecord = computeRecordFromGames(oppGames, oppAbbr);
    const oppAvg = computeTeamAveragesFromGames(oppAbbr, oppGames);

    const isHome = (g.homeTeamAbbr || "").toUpperCase() === "DAL";
    const pBase = modelWinProb(modelType, {
      teamWinPct: record.winPct || 0.5,
      oppWinPct: oppRecord.winPct || 0.5,
      teamPointDiff: cowAvg.pointDiffPerGame || 0,
      oppPointDiff: oppAvg.pointDiffPerGame || 0,
      isHome,
      scenarioModifier,
    });

    // Hybrid: mix the legacy model with the Elo engine's read of the game.
    let pHybrid = pBase;
    // The next game carries full current injury costs; later ones the average.
    const isNext = g === nextGame;
    const dalElo = powerForGame(eloSnap.byTeam.DAL, isNext);
    const oppElo = powerForGame(eloSnap.byTeam[String(oppAbbr || "").toUpperCase()], isNext);
    if (eloSnap.available && Number.isFinite(dalElo) && Number.isFinite(oppElo)) {
      const pElo = eloWinProb(dalElo, oppElo, isHome ? ELO_HOME_FIELD : -ELO_HOME_FIELD);
      pHybrid = blendWithElo(pBase, pElo, 0.5);
    }

    const p = applyChaos(pHybrid, chaos);
    probs.push(p);
  }

  const sim = monteCarloSeason(record.wins, probs, iterations, playoffCurve(dalSim));

  return {
    playoffProbability: sim.playoffProbability,
    expectedWins: sim.expectedWins,
    gamesRemaining: remaining.length,
    modelUsed: modelType,
    generatedAt: new Date().toISOString(),
    perGameWinProbabilities: probs,
    // Unadjusted league-simulation odds (no scenario or chaos applied).
    league: dalSim
      ? {
          playoffProbability: dalSim.playoffPct / 100,
          divisionProbability: dalSim.divisionPct / 100,
          conferenceProbability: dalSim.reachSBPct / 100,
          superbowlProbability: dalSim.winSBPct / 100,
          expectedWins: dalSim.avgWins,
          iterations: leagueSim.iterations,
          engine: leagueSim.engine,
        }
      : null,
  };
}

module.exports = { generateEspnPrediction };

