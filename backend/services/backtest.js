"use strict";

/**
 * backtest
 * Scores the model on a finished season, using only what it would have known
 * at the time.
 *
 *   Games: before each week, ratings are rebuilt from the earlier weeks and
 *   every game that week gets a win probability. Scored with Brier, log loss
 *   and accuracy against two baselines (a coin flip, and home field alone).
 *
 *   Playoffs: at each checkpoint week, the later results are hidden and the
 *   league season simulator forecasts every team's playoff odds; those are
 *   scored against who actually made it.
 *
 * The preseason prior is last season's Elo regressed by a third, with no
 * market input: the stored futures board describes the current season, and
 * using it for a past one would leak information the model never had.
 * Injury and news adjustments are not replayed (there is no history of them),
 * so this measures the results-based Elo core.
 */

const {
  ELO_BASE,
  ELO_K,
  ELO_HOME_FIELD,
  eloWinProb,
  replayGamesToElo,
  computeCarryoverPrior,
  buildLeagueGames,
} = require("./ratingsEngine");
const { getNFLTeamList, getNFLTeamMetadata } = require("./espn");
const { calibrationBuckets } = require("./oddsMath");
const { _internals: { runSimulation } } = require("./seasonSimulator");

const DEFAULT_CHECKPOINTS = [4, 8, 12, 16];
const PLAYOFF_SPOTS_SHARE = 14 / 32;
const MIN_COMPLETED_GAMES = 250;
const BACKTEST_TTL_MS = 24 * 60 * 60 * 1000;

const round = (x, d = 4) => Number(Number(x).toFixed(d));

/** Brier, log loss and accuracy for [{ prob, outcome }] binary samples. */
function scoreBinary(samples) {
  const n = samples.length;
  if (!n) return { n: 0, brier: null, logLoss: null, accuracy: null };
  let brier = 0, ll = 0, correct = 0;
  for (const { prob, outcome } of samples) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, prob));
    brier += (p - outcome) ** 2;
    ll += -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
    if ((p >= 0.5 ? 1 : 0) === outcome) correct++;
  }
  return { n, brier: round(brier / n), logLoss: round(ll / n), accuracy: round(correct / n) };
}

function regularSeason(games) {
  return games.filter((g) => g.completed && Number(g.week) >= 1 && Number(g.week) <= 18);
}

/**
 * Pure scorer over supplied data. `games` is one finished season's league
 * schedule, `prior` a code → Elo map, `teams` [{ code, name, conference,
 * division }].
 */
function backtestFromData({
  year = null,
  games,
  prior = {},
  teams,
  checkpoints = DEFAULT_CHECKPOINTS,
  iterations = 2000,
  seed = 7,
  k = ELO_K,
  homeField = ELO_HOME_FIELD,
  includePlayoffs = true,
}) {
  const season = regularSeason(games);
  const eloOpts = { k, homeField };
  const ratingOf = (elo, code) => elo[code] ?? prior[code] ?? ELO_BASE;

  /* Game level: predict each week from the weeks before it. */
  const weeks = [...new Set(season.map((g) => Number(g.week)))].sort((a, b) => a - b);
  const gameSamples = [];
  const homeOnly = [];
  const homeFieldProb = eloWinProb(ELO_BASE, ELO_BASE, homeField);
  for (const w of weeks) {
    const { elo } = replayGamesToElo(season.filter((g) => Number(g.week) < w), prior, eloOpts);
    for (const g of season.filter((x) => Number(x.week) === w)) {
      if (g.homeScore === g.awayScore) continue; // ties score as neither
      const h = String(g.homeTeamAbbr).toUpperCase();
      const a = String(g.awayTeamAbbr).toUpperCase();
      const outcome = g.homeScore > g.awayScore ? 1 : 0;
      gameSamples.push({ prob: eloWinProb(ratingOf(elo, h), ratingOf(elo, a), homeField), outcome, week: w });
      homeOnly.push({ prob: homeFieldProb, outcome });
    }
  }

  const gamesResult = {
    ...scoreBinary(gameSamples),
    baselines: {
      coinFlip: { brier: 0.25, logLoss: round(Math.log(2)), accuracy: 0.5 },
      homeFieldOnly: scoreBinary(homeOnly),
    },
    calibration: calibrationBuckets(gameSamples),
  };

  if (!includePlayoffs) {
    return { year, settings: { k, homeField, priorTeams: Object.keys(prior).length }, games: gamesResult };
  }

  /* Playoff level: who actually got in, then forecasts from each checkpoint. */
  const finalElo = replayGamesToElo(season, prior, eloOpts).elo;
  const ratingsAt = (elo) =>
    teams.map((t) => ({ ...t, power: ratingOf(elo, t.code) }));

  const actual = runSimulation({ ratings: ratingsAt(finalElo), games: season, iterations: 500, seed });
  const madePlayoffs = new Set(actual.teams.filter((t) => t.playoffPct >= 50).map((t) => t.code));

  const playoffSamples = [];
  const checkpointsOut = [];
  for (const week of checkpoints) {
    if (week >= weeks[weeks.length - 1]) continue;
    const known = season.filter((g) => Number(g.week) <= week);
    const { elo } = replayGamesToElo(known, prior, eloOpts);
    const masked = season.map((g) => (Number(g.week) <= week ? g : { ...g, completed: false }));
    const sim = runSimulation({ ratings: ratingsAt(elo), games: masked, iterations, seed: seed + week });

    const samples = sim.teams.map((t) => ({
      code: t.code,
      prob: t.playoffPct / 100,
      outcome: madePlayoffs.has(t.code) ? 1 : 0,
    }));
    playoffSamples.push(...samples);
    const naive = samples.map((s) => ({ prob: PLAYOFF_SPOTS_SHARE, outcome: s.outcome }));

    checkpointsOut.push({
      afterWeek: week,
      ...scoreBinary(samples),
      baselineBrier: scoreBinary(naive).brier,
      biggestMisses: samples
        .slice()
        .sort((a, b) => Math.abs(b.prob - b.outcome) - Math.abs(a.prob - a.outcome))
        .slice(0, 3)
        .map((s) => ({ code: s.code, playoffPct: round(s.prob * 100, 1), madePlayoffs: Boolean(s.outcome) })),
    });
  }

  return {
    year,
    settings: { k, homeField, priorTeams: Object.keys(prior).length, iterations, checkpoints },
    games: gamesResult,
    playoffs: {
      actualPlayoffTeams: [...madePlayoffs].sort(),
      checkpoints: checkpointsOut,
      overall: scoreBinary(playoffSamples),
      calibration: calibrationBuckets(playoffSamples, 5),
    },
  };
}

async function loadSeason(year) {
  const [{ games }, prior, list] = await Promise.all([
    buildLeagueGames(year),
    computeCarryoverPrior(year),
    getNFLTeamList(),
  ]);
  const completed = regularSeason(games).length;
  if (completed < MIN_COMPLETED_GAMES) {
    throw new Error(`Season ${year} has ${completed} completed regular-season games; a backtest needs a finished season.`);
  }
  const teams = list.map((t) => {
    const meta = getNFLTeamMetadata(t.code) || {};
    return { code: t.code, name: meta.displayName || t.code, conference: meta.conference, division: meta.division };
  });
  return { games, prior, teams };
}

const _cache = new Map();

/** Backtest one finished season from ESPN data. Cached; past seasons don't change. */
function runBacktest({ year, checkpoints, iterations, k, homeField } = {}) {
  const key = JSON.stringify({ year, checkpoints, iterations, k, homeField });
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < BACKTEST_TTL_MS) return cached.promise;

  const promise = loadSeason(year).then((data) =>
    backtestFromData({ year, ...data, checkpoints, iterations, k, homeField })
  );
  _cache.set(key, { promise, ts: Date.now() });
  promise.catch(() => _cache.delete(key));
  return promise;
}

/**
 * Game-level Brier for every K / home-field pair, best first. Playoff
 * scoring is skipped: it would multiply the cost and the game-level score
 * already drives it.
 */
async function tuneParameters({ year, ks = [15, 20, 25, 30], homeFields = [20, 35, 48, 60] } = {}) {
  const data = await loadSeason(year);
  const rows = [];
  for (const k of ks) {
    for (const homeField of homeFields) {
      const out = backtestFromData({ year, ...data, k, homeField, includePlayoffs: false });
      rows.push({ k, homeField, brier: out.games.brier, logLoss: out.games.logLoss, accuracy: out.games.accuracy });
    }
  }
  return rows.sort((a, b) => a.brier - b.brier);
}

module.exports = {
  DEFAULT_CHECKPOINTS,
  scoreBinary,
  backtestFromData,
  runBacktest,
  tuneParameters,
};
