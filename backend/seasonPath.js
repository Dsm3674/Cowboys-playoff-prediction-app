"use strict";

const {
  getNFLSeasonYear,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames
} = require("./services/espn");
const {
  getEloSnapshot,
  blendWithElo,
  eloWinProb,
  ELO_HOME_FIELD
} = require("./services/ratingsEngine");

const DEFAULT_ITERATIONS = 10000;

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asInteger(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(asNumber(value, 0) * factor) / factor;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function normalizeAbbr(value, fallback = "DAL") {
  const raw = String(value || fallback).trim().toUpperCase();
  return raw || fallback;
}

function normalizeIterations(value) {
  const n = asInteger(value, DEFAULT_ITERATIONS);
  return clamp(n, 500, 50000);
}

function normalizeChaos(value) {
  return clamp(asNumber(value, 0), 0, 1.5);
}

function teamRecordWins(record) {
  return asNumber(record?.wins, 0);
}

function teamRecordLosses(record) {
  return asNumber(record?.losses, 0);
}

function totalGames(record) {
  return teamRecordWins(record) + teamRecordLosses(record);
}

function recordWinPct(record) {
  const total = totalGames(record);
  if (!total) return 0.5;
  return teamRecordWins(record) / total;
}

function opponentOf(teamAbbr, game) {
  return game.homeTeamAbbr === teamAbbr ? game.awayTeamAbbr : game.homeTeamAbbr;
}

function createSeededRng(seed) {
  let state = Math.floor(seed) % 2147483647;
  if (state <= 0) state += 2147483646;

  return function next() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function estimatePointDiffStrength(teamAverages) {
  return asNumber(teamAverages?.avgPointDiff, teamAverages?.pointDifferential || 0);
}

function estimateScoringStrength(teamAverages) {
  return asNumber(teamAverages?.avgPointsFor, teamAverages?.pointsFor || 0);
}

function estimateDefenseStrength(teamAverages) {
  return asNumber(teamAverages?.avgPointsAgainst, teamAverages?.pointsAgainst || 0);
}

function estimateOpponentStrength(game) {
  return clamp(asNumber(game.opponentWinPct, game.oppWinPct || 0.5), 0, 1);
}

function estimateRestAdvantage(game) {
  return clamp(asNumber(game.restAdvantage, 0), -10, 10);
}

function estimateSpread(game) {
  return clamp(asNumber(game.spread, 0), -21, 21);
}

function estimateInjuryPenalty(game) {
  return clamp(asNumber(game.injuryPenalty, 0), 0, 1.5);
}

function estimateTravelPenalty(game) {
  return clamp(asNumber(game.travelPenalty, 0), 0, 1);
}

function estimateMotivationBoost(game) {
  return clamp(asNumber(game.motivationBoost, 0), 0, 1);
}

function estimateGameWinProbability(teamAbbr, game, teamAverages, record, chaos = 0) {
  const isHome = game.homeTeamAbbr === teamAbbr;
  const pointDiff = estimatePointDiffStrength(teamAverages);
  const scoring = estimateScoringStrength(teamAverages);
  const defense = estimateDefenseStrength(teamAverages);
  const winPct = recordWinPct(record);
  const opponentStrength = estimateOpponentStrength(game);
  const spread = estimateSpread(game);
  const restAdvantage = estimateRestAdvantage(game);
  const injuryPenalty = estimateInjuryPenalty(game);
  const travelPenalty = estimateTravelPenalty(game);
  const motivationBoost = estimateMotivationBoost(game);

  const rating =
    pointDiff * 0.085 +
    (scoring - defense) * 0.01 +
    (winPct - 0.5) * 1.45 +
    (isHome ? 0.24 : -0.12) +
    spread * 0.035 +
    restAdvantage * 0.028 -
    (opponentStrength - 0.5) * 1.2 -
    injuryPenalty * 0.55 -
    travelPenalty * 0.18 +
    motivationBoost * 0.1 -
    chaos * 0.08;

  return clamp(sigmoid(rating), 0.04, 0.96);
}

function normalizeGame(teamAbbr, game, teamAverages, record, chaos, idx, eloProb = null) {
  const base = estimateGameWinProbability(teamAbbr, game, teamAverages, record, chaos);
  const pWin = Number.isFinite(eloProb) ? blendWithElo(base, eloProb, 0.5) : base;
  return {
    idx,
    date: game.date || null,
    completed: Boolean(game.completed),
    status: game.status || null,
    opp: opponentOf(teamAbbr, game),
    isHome: game.homeTeamAbbr === teamAbbr,
    homeTeamAbbr: game.homeTeamAbbr,
    awayTeamAbbr: game.awayTeamAbbr,
    pWin: round(pWin, 4),
    opponentWinPct: round(estimateOpponentStrength(game), 4),
    spread: round(estimateSpread(game), 2),
    restAdvantage: round(estimateRestAdvantage(game), 2),
    injuryPenalty: round(estimateInjuryPenalty(game), 3),
    travelPenalty: round(estimateTravelPenalty(game), 3),
    motivationBoost: round(estimateMotivationBoost(game), 3)
  };
}

function projectPlayoffProbability(totalWins) {
  if (totalWins >= 14) return 0.995;
  if (totalWins === 13) return 0.985;
  if (totalWins === 12) return 0.955;
  if (totalWins === 11) return 0.855;
  if (totalWins === 10) return 0.635;
  if (totalWins === 9) return 0.335;
  if (totalWins === 8) return 0.125;
  return 0.03;
}

function classifyLeverage(swing) {
  if (swing >= 0.16) return "SEASON_SWING";
  if (swing >= 0.12) return "MUST_WIN";
  if (swing >= 0.08) return "HIGH_LEVERAGE";
  if (swing >= 0.04) return "MEDIUM_LEVERAGE";
  return "NORMAL";
}

function simulateSeasonOutcome({ currentWins, remainingGames, forcedGameIndex = null, forcedOutcome = null, seed = 1 }) {
  const rng = createSeededRng(seed);
  let wins = currentWins;

  for (let i = 0; i < remainingGames.length; i += 1) {
    if (forcedGameIndex === i) {
      if (forcedOutcome === "WIN") wins += 1;
      continue;
    }

    const p = clamp(asNumber(remainingGames[i].pWin, 0.5), 0.01, 0.99);
    if (rng() < p) wins += 1;
  }

  const playoffProbability = projectPlayoffProbability(wins);

  return {
    totalWins: wins,
    playoffProbability
  };
}

function summarizeSimulations(results) {
  if (!results.length) {
    return {
      averageWins: 0,
      averagePlayoffProbability: 0,
      minWins: 0,
      maxWins: 0,
      winDistribution: {}
    };
  }

  let totalWins = 0;
  let totalPlayoffProbability = 0;
  let minWins = results[0].totalWins;
  let maxWins = results[0].totalWins;
  const winDistribution = {};

  for (const result of results) {
    totalWins += result.totalWins;
    totalPlayoffProbability += result.playoffProbability;
    if (result.totalWins < minWins) minWins = result.totalWins;
    if (result.totalWins > maxWins) maxWins = result.totalWins;
    winDistribution[result.totalWins] = (winDistribution[result.totalWins] || 0) + 1;
  }

  return {
    averageWins: round(totalWins / results.length, 4),
    averagePlayoffProbability: round(totalPlayoffProbability / results.length, 4),
    minWins,
    maxWins,
    winDistribution
  };
}

function runScenario({ currentWins, remainingGames, iterations, seasonYear, forcedGameIndex = null, forcedOutcome = null }) {
  const results = [];

  for (let i = 0; i < iterations; i += 1) {
    results.push(
      simulateSeasonOutcome({
        currentWins,
        remainingGames,
        forcedGameIndex,
        forcedOutcome,
        seed: seasonYear * 100000 + i * 97 + (forcedGameIndex === null ? 7 : forcedGameIndex * 13) + (forcedOutcome === "WIN" ? 3 : 11)
      })
    );
  }

  return summarizeSimulations(results);
}

async function loadSeasonModel({ teamAbbr = "DAL", year, chaos = 0 }) {
  const seasonYear = year || getNFLSeasonYear();
  const normalizedTeam = normalizeAbbr(teamAbbr);
  const normalizedChaos = normalizeChaos(chaos);

  const [games, eloSnap] = await Promise.all([
    fetchTeamGamesSeasonToDate(normalizedTeam, seasonYear),
    getEloSnapshot({ year: seasonYear })
  ]);
  const record = computeRecordFromGames(games);
  const teamAverages = computeTeamAveragesFromGames(normalizedTeam, games);

  // Elo's read on each remaining game, blended into the legacy estimate.
  const teamElo = eloSnap.byTeam[normalizedTeam]?.power;
  const eloProbFor = (game) => {
    if (!eloSnap.available || !Number.isFinite(teamElo)) return null;
    const oppElo = eloSnap.byTeam[opponentOf(normalizedTeam, game)]?.power;
    if (!Number.isFinite(oppElo)) return null;
    const isHome = game.homeTeamAbbr === normalizedTeam;
    return eloWinProb(teamElo, oppElo, isHome ? ELO_HOME_FIELD : -ELO_HOME_FIELD);
  };

  const remainingGames = games
    .filter((game) => !game.completed)
    .map((game, idx) =>
      normalizeGame(normalizedTeam, game, teamAverages, record, normalizedChaos, idx, eloProbFor(game))
    );

  return {
    seasonYear,
    teamAbbr: normalizedTeam,
    record,
    teamAverages,
    currentWins: teamRecordWins(record),
    currentLosses: teamRecordLosses(record),
    remainingGames,
    chaos: normalizedChaos
  };
}

async function buildSeasonPaths({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);

  const baseline = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames,
    iterations: normalizedIterations,
    seasonYear: model.seasonYear
  });

  return {
    season: model.seasonYear,
    teamAbbr: model.teamAbbr,
    chaos: model.chaos,
    iterations: normalizedIterations,
    record: model.record,
    baseline,
    remainingGames: model.remainingGames.map((game) => ({
      idx: game.idx,
      date: game.date,
      opp: game.opp,
      isHome: game.isHome,
      status: game.status,
      pWin: game.pWin,
      spread: game.spread,
      opponentWinPct: game.opponentWinPct,
      restAdvantage: game.restAdvantage,
      injuryPenalty: game.injuryPenalty,
      travelPenalty: game.travelPenalty,
      motivationBoost: game.motivationBoost
    }))
  };
}

async function computeMustWinGames({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);

  if (!model.remainingGames.length) return [];

  const baseline = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames,
    iterations: normalizedIterations,
    seasonYear: model.seasonYear
  });

  const games = model.remainingGames.map((game, index) => {
    const forcedWin = runScenario({
      currentWins: model.currentWins,
      remainingGames: model.remainingGames,
      iterations: normalizedIterations,
      seasonYear: model.seasonYear,
      forcedGameIndex: index,
      forcedOutcome: "WIN"
    });

    const forcedLoss = runScenario({
      currentWins: model.currentWins,
      remainingGames: model.remainingGames,
      iterations: normalizedIterations,
      seasonYear: model.seasonYear,
      forcedGameIndex: index,
      forcedOutcome: "LOSS"
    });

    const swing = Math.abs(forcedWin.averagePlayoffProbability - forcedLoss.averagePlayoffProbability);
    const averageWinDelta = forcedWin.averageWins - forcedLoss.averageWins;

    return {
      idx: game.idx,
      date: game.date,
      opp: game.opp,
      isHome: game.isHome,
      pWin: game.pWin,
      spread: game.spread,
      opponentWinPct: game.opponentWinPct,
      baselinePlayoffProb: baseline.averagePlayoffProbability,
      forcedWinPlayoffProb: forcedWin.averagePlayoffProbability,
      forcedLossPlayoffProb: forcedLoss.averagePlayoffProbability,
      baselineAverageWins: baseline.averageWins,
      forcedWinAverageWins: forcedWin.averageWins,
      forcedLossAverageWins: forcedLoss.averageWins,
      averageWinDelta: round(averageWinDelta, 4),
      swing: round(swing, 4),
      leverage: classifyLeverage(swing)
    };
  });

  games.sort((a, b) => b.swing - a.swing);
  return games;
}

async function computeScheduleSensitivity({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);

  const lowChaos = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames.map((game) => ({ ...game, pWin: clamp(game.pWin + 0.03, 0.04, 0.96) })),
    iterations: normalizedIterations,
    seasonYear: model.seasonYear
  });

  const highChaos = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames.map((game) => ({ ...game, pWin: clamp(game.pWin - 0.03, 0.04, 0.96) })),
    iterations: normalizedIterations,
    seasonYear: model.seasonYear
  });

  return {
    season: model.seasonYear,
    teamAbbr: model.teamAbbr,
    lowChaos,
    highChaos,
    deltaPlayoffProbability: round(lowChaos.averagePlayoffProbability - highChaos.averagePlayoffProbability, 4),
    deltaAverageWins: round(lowChaos.averageWins - highChaos.averageWins, 4)
  };
}

module.exports = {
  buildSeasonPaths,
  computeMustWinGames,
  computeScheduleSensitivity,
  estimateGameWinProbability,
  simulateSeasonOutcome
};
