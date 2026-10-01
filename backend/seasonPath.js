"use strict";

/**
 * seasonPath
 * One team's remaining schedule: per-game win probabilities, the most likely
 * win/loss paths, win-total scenarios, and which games carry the most
 * playoff leverage.
 *
 * Game probabilities are the model's: the sportsbook line when a game has
 * one, otherwise Elo (neutral sites get no home edge; the next game carries
 * full current injury costs). "Chaos" pulls every game toward a coin flip,
 * up to halving each edge at the maximum.
 *
 * Playoff odds for a final win total come from the team's measured curve in
 * the league simulation. Must-win leverage comes straight from the league
 * simulation when it is available: P(playoffs | win this game) minus
 * P(playoffs | lose it), measured with every other game and tiebreaker in
 * play, rather than through win totals.
 */

const {
  getNFLSeasonYear,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
} = require("./services/espn");
const {
  getEloSnapshot,
  eloWinProb,
  powerForGame,
  nextGameOf,
  ELO_HOME_FIELD,
} = require("./services/ratingsEngine");
const { getSeasonSimulation, playoffCurve, gameLeverage } = require("./services/seasonSimulator");
const { SPREAD_LOGIT_SCALE } = require("./services/oddsMath");

const DEFAULT_ITERATIONS = 10000;
const MAX_CHAOS = 1.5;
const MAX_ENUMERATED_GAMES = 18;

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

function normalizeAbbr(value, fallback = "DAL") {
  const raw = String(value || fallback).trim().toUpperCase();
  return raw || fallback;
}

function normalizeIterations(value) {
  return clamp(asInteger(value, DEFAULT_ITERATIONS), 500, 50000);
}

function normalizeChaos(value) {
  return clamp(asNumber(value, 0), 0, MAX_CHAOS);
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

/* Pull a probability toward 0.5: chaos 0 leaves it, MAX_CHAOS halves the edge. */
function applyChaos(p, chaos) {
  return 0.5 + (p - 0.5) * (1 - chaos / (2 * MAX_CHAOS));
}

/**
 * The model's probability that `teamAbbr` wins `game`, and where it came
 * from. Falls back to a record-and-venue guess only when no ratings exist.
 */
function modelGameProb(teamAbbr, game, { eloSnap, isNext, record }) {
  const isHome = game.homeTeamAbbr === teamAbbr;
  if (Number.isFinite(game.marketHomeProb)) {
    return { p: isHome ? game.marketHomeProb : 1 - game.marketHomeProb, source: "market" };
  }
  if (eloSnap?.available) {
    const teamElo = powerForGame(eloSnap.byTeam[teamAbbr], isNext);
    const oppElo = powerForGame(eloSnap.byTeam[opponentOf(teamAbbr, game)], isNext);
    if (Number.isFinite(teamElo) && Number.isFinite(oppElo)) {
      const hfa = game.neutralSite ? 0 : ELO_HOME_FIELD;
      return { p: eloWinProb(teamElo, oppElo, isHome ? hfa : -hfa), source: "elo" };
    }
  }
  const games = (record?.wins || 0) + (record?.losses || 0) + (record?.ties || 0);
  const winPct = games ? ((record.wins || 0) + 0.5 * (record.ties || 0)) / games : 0.5;
  const z = (winPct - 0.5) * 1.45 + (game.neutralSite ? 0 : isHome ? 0.12 : -0.12);
  return { p: clamp(1 / (1 + Math.exp(-z)), 0.04, 0.96), source: "record" };
}

/**
 * Playoff odds for a final win total. `curve` is this team's measured curve
 * from the league simulation (its division, schedule and tiebreak context);
 * the fixed league-average table is the fallback when the sim is unavailable.
 */
function projectPlayoffProbability(totalWins, curve = null) {
  if (curve) {
    const w = Math.max(0, Math.min(17, Math.round(totalWins)));
    if (Number.isFinite(curve[w])) return curve[w];
  }
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

/* ── Win-total scenarios ───────────────────────────────────────────────── */

function simulateSeasonOutcome({ currentWins, remainingGames, forcedGameIndex = null, forcedOutcome = null, seed = 1, curve = null }) {
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

  return { totalWins: wins, playoffProbability: projectPlayoffProbability(wins, curve) };
}

function runScenario({ currentWins, remainingGames, iterations, seasonYear, forcedGameIndex = null, forcedOutcome = null, curve = null }) {
  let totalWins = 0;
  let totalPlayoff = 0;
  let minWins = Infinity;
  let maxWins = -Infinity;
  const winDistribution = {};

  for (let i = 0; i < iterations; i += 1) {
    const r = simulateSeasonOutcome({
      currentWins,
      remainingGames,
      forcedGameIndex,
      forcedOutcome,
      curve,
      seed: seasonYear * 100000 + i * 97 + (forcedGameIndex === null ? 7 : forcedGameIndex * 13) + (forcedOutcome === "WIN" ? 3 : 11),
    });
    totalWins += r.totalWins;
    totalPlayoff += r.playoffProbability;
    minWins = Math.min(minWins, r.totalWins);
    maxWins = Math.max(maxWins, r.totalWins);
    winDistribution[r.totalWins] = (winDistribution[r.totalWins] || 0) + 1;
  }

  if (!iterations) {
    return { averageWins: 0, averagePlayoffProbability: 0, minWins: 0, maxWins: 0, winDistribution: {} };
  }
  return {
    averageWins: round(totalWins / iterations, 4),
    averagePlayoffProbability: round(totalPlayoff / iterations, 4),
    minWins,
    maxWins,
    winDistribution,
  };
}

/**
 * The k most likely win/loss sequences over the remaining games, treating
 * games as independent. Exact enumeration up to MAX_ENUMERATED_GAMES games.
 */
function mostLikelyPaths(games, k, curve, currentWins) {
  const n = games.length;
  if (!n || n > MAX_ENUMERATED_GAMES) return [];
  const p = games.map((g) => clamp(g.pWin, 1e-6, 1 - 1e-6));
  const top = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let prob = 1;
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) { prob *= p[i]; wins++; } else prob *= 1 - p[i];
    }
    if (top.length < k) {
      top.push({ mask, prob, wins });
      top.sort((a, b) => b.prob - a.prob);
    } else if (prob > top[k - 1].prob) {
      top[k - 1] = { mask, prob, wins };
      top.sort((a, b) => b.prob - a.prob);
    }
  }
  return top.map(({ mask, prob, wins }) => ({
    probability: round(prob, 6),
    winsAdded: wins,
    finalWins: currentWins + wins,
    playoffProbability: round(projectPlayoffProbability(currentWins + wins, curve), 4),
    outcomes: games.map((g, i) => ({ idx: g.idx, opp: g.opp, result: mask & (1 << i) ? "W" : "L" })),
  }));
}

/* ── Model loading ─────────────────────────────────────────────────────── */

async function loadSeasonModel({ teamAbbr = "DAL", year, chaos = 0 }) {
  const seasonYear = year || getNFLSeasonYear();
  const team = normalizeAbbr(teamAbbr);
  const normalizedChaos = normalizeChaos(chaos);

  const [games, eloSnap, sim] = await Promise.all([
    fetchTeamGamesSeasonToDate(team, seasonYear),
    getEloSnapshot({ year: seasonYear }),
    getSeasonSimulation({ year: seasonYear }).catch(() => null),
  ]);
  const record = computeRecordFromGames(games, team);
  const nextGame = nextGameOf(games);

  const remainingGames = games
    .filter((game) => !game.completed)
    .map((game, idx) => {
      const { p, source } = modelGameProb(team, game, { eloSnap, isNext: game === nextGame, record });
      const pWin = applyChaos(p, normalizedChaos);
      const logit = Math.log(pWin / (1 - pWin));
      return {
        idx,
        id: game.id || null,
        date: game.date || null,
        completed: false,
        status: game.status || null,
        opp: opponentOf(team, game),
        isHome: game.homeTeamAbbr === team,
        neutralSite: Boolean(game.neutralSite),
        homeTeamAbbr: game.homeTeamAbbr,
        awayTeamAbbr: game.awayTeamAbbr,
        pWin: round(pWin, 4),
        // Implied point spread from the team's side (positive = favored).
        spread: round(logit * SPREAD_LOGIT_SCALE, 1),
        source,
      };
    });

  const simTeam = sim?.teams.find((t) => t.code === team) || null;

  return {
    seasonYear,
    teamAbbr: team,
    record,
    currentWins: asNumber(record.wins, 0),
    currentLosses: asNumber(record.losses, 0),
    remainingGames,
    chaos: normalizedChaos,
    playoffCurve: playoffCurve(simTeam),
    simPlayoffProbability: simTeam ? simTeam.playoffPct / 100 : null,
    leverage: sim ? gameLeverage(sim, team) : [],
  };
}

/* Match a schedule game to the simulation's leverage row. */
function leverageRow(model, game) {
  return model.leverage.find((l) =>
    (game.id && l.id === game.id) ||
    (l.home === game.homeTeamAbbr && l.away === game.awayTeamAbbr && String(l.date) === String(game.date))
  ) || null;
}

/* ── Public API ────────────────────────────────────────────────────────── */

async function buildSeasonPaths({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS, k = 25 } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);

  const baseline = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames,
    iterations: normalizedIterations,
    seasonYear: model.seasonYear,
    curve: model.playoffCurve,
  });

  return {
    season: model.seasonYear,
    teamAbbr: model.teamAbbr,
    chaos: model.chaos,
    iterations: normalizedIterations,
    record: model.record,
    baseline,
    leaguePlayoffProbability: model.simPlayoffProbability,
    remainingGames: model.remainingGames,
    paths: mostLikelyPaths(model.remainingGames, clamp(asInteger(k, 25), 1, 60), model.playoffCurve, model.currentWins),
  };
}

async function computeMustWinGames({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);

  if (!model.remainingGames.length) return [];

  // Without chaos, the league simulation measures each game's leverage
  // directly. Chaos changes every game's odds, so it falls back to the
  // win-total method on the chaos-adjusted probabilities.
  const useSim = model.chaos === 0 && model.leverage.length > 0;

  const baseline = runScenario({
    currentWins: model.currentWins,
    remainingGames: model.remainingGames,
    iterations: normalizedIterations,
    seasonYear: model.seasonYear,
    curve: model.playoffCurve,
  });

  const games = model.remainingGames.map((game, index) => {
    const forcedWin = runScenario({
      currentWins: model.currentWins,
      remainingGames: model.remainingGames,
      iterations: normalizedIterations,
      seasonYear: model.seasonYear,
      curve: model.playoffCurve,
      forcedGameIndex: index,
      forcedOutcome: "WIN",
    });
    const forcedLoss = runScenario({
      currentWins: model.currentWins,
      remainingGames: model.remainingGames,
      iterations: normalizedIterations,
      seasonYear: model.seasonYear,
      curve: model.playoffCurve,
      forcedGameIndex: index,
      forcedOutcome: "LOSS",
    });

    let ifWin = forcedWin.averagePlayoffProbability;
    let ifLoss = forcedLoss.averagePlayoffProbability;
    let base = baseline.averagePlayoffProbability;
    let method = "win-total";

    const row = useSim ? leverageRow(model, game) : null;
    if (row && row.playoffPctIfHomeWins != null && row.playoffPctIfAwayWins != null) {
      ifWin = (game.isHome ? row.playoffPctIfHomeWins : row.playoffPctIfAwayWins) / 100;
      ifLoss = (game.isHome ? row.playoffPctIfAwayWins : row.playoffPctIfHomeWins) / 100;
      base = model.simPlayoffProbability ?? base;
      method = "league-simulation";
    }

    const swing = Math.abs(ifWin - ifLoss);
    return {
      idx: game.idx,
      date: game.date,
      opp: game.opp,
      isHome: game.isHome,
      pWin: game.pWin,
      spread: game.spread,
      baselinePlayoffProb: round(base, 4),
      forcedWinPlayoffProb: round(ifWin, 4),
      forcedLossPlayoffProb: round(ifLoss, 4),
      baselineAverageWins: baseline.averageWins,
      forcedWinAverageWins: forcedWin.averageWins,
      forcedLossAverageWins: forcedLoss.averageWins,
      averageWinDelta: round(forcedWin.averageWins - forcedLoss.averageWins, 4),
      swing: round(swing, 4),
      leverage: classifyLeverage(swing),
      method,
    };
  });

  games.sort((a, b) => b.swing - a.swing);
  return games;
}

/**
 * Games the team is not playing in, ranked by how much their result moves
 * the team's playoff odds: who to root for, measured in the league sim.
 */
async function computeRootingGuide({ teamAbbr = "DAL", year, limit = 10 } = {}) {
  const team = normalizeAbbr(teamAbbr);
  const sim = await getSeasonSimulation({ year });
  const simTeam = sim.teams.find((t) => t.code === team);
  const rows = gameLeverage(sim, team)
    .filter((g) => g.home !== team && g.away !== team)
    .filter((g) => g.playoffPctIfHomeWins != null && g.playoffPctIfAwayWins != null)
    .map((g) => {
      const diff = g.playoffPctIfHomeWins - g.playoffPctIfAwayWins;
      return {
        id: g.id,
        week: g.week,
        date: g.date,
        home: g.home,
        away: g.away,
        homeWinPct: g.homeWinPct,
        rootFor: diff >= 0 ? g.home : g.away,
        playoffPctIfHomeWins: g.playoffPctIfHomeWins,
        playoffPctIfAwayWins: g.playoffPctIfAwayWins,
        swingPts: round(Math.abs(diff), 2),
      };
    })
    .sort((a, b) => b.swingPts - a.swingPts)
    .slice(0, clamp(asInteger(limit, 10), 1, 50));

  return {
    team,
    year: sim.year,
    playoffPct: simTeam ? simTeam.playoffPct : null,
    iterations: sim.iterations,
    games: rows,
  };
}

async function computeScheduleSensitivity({ teamAbbr = "DAL", year, chaos = 0, iterations = DEFAULT_ITERATIONS } = {}) {
  const model = await loadSeasonModel({ teamAbbr, year, chaos });
  const normalizedIterations = normalizeIterations(iterations);
  const shift = (d) => model.remainingGames.map((g) => ({ ...g, pWin: clamp(g.pWin + d, 0.04, 0.96) }));

  const lowChaos = runScenario({
    currentWins: model.currentWins,
    remainingGames: shift(0.03),
    iterations: normalizedIterations,
    seasonYear: model.seasonYear,
    curve: model.playoffCurve,
  });
  const highChaos = runScenario({
    currentWins: model.currentWins,
    remainingGames: shift(-0.03),
    iterations: normalizedIterations,
    seasonYear: model.seasonYear,
    curve: model.playoffCurve,
  });

  return {
    season: model.seasonYear,
    teamAbbr: model.teamAbbr,
    lowChaos,
    highChaos,
    deltaPlayoffProbability: round(lowChaos.averagePlayoffProbability - highChaos.averagePlayoffProbability, 4),
    deltaAverageWins: round(lowChaos.averageWins - highChaos.averageWins, 4),
  };
}

module.exports = {
  buildSeasonPaths,
  computeMustWinGames,
  computeRootingGuide,
  computeScheduleSensitivity,
  projectPlayoffProbability,
  simulateSeasonOutcome,
  _internals: { applyChaos, modelGameProb, mostLikelyPaths },
};
