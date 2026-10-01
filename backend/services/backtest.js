"use strict";

/**
 * backtest
 * Scores the model on finished seasons, using only what it would have known
 * at the time.
 *
 *   Games: before each week, ratings are rebuilt from the earlier weeks and
 *   every game that week gets a win probability. Scored with Brier, log loss
 *   and accuracy against a coin flip, home field alone, and (where the data
 *   has them) the Vegas closing moneylines, de-vigged.
 *
 *   Playoffs: at each checkpoint week, the later results are hidden and the
 *   league season simulator forecasts every team's playoff odds; those are
 *   scored against who actually made it.
 *
 * Data: nflverse's public games file (every game since 1999 with scores,
 * neutral-site flags and closing lines), with ESPN as the fallback. The
 * preseason prior is built from the two seasons before, regressed toward 1500
 * each offseason, with no market input: the stored futures board describes
 * the current season, and using it for a past one would leak information the
 * model never had. Injury and news adjustments are not replayed (there is no
 * history of them), so this measures the results-based Elo core.
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
const { getNFLTeamList, getNFLTeamMetadata, getNFLTeamCatalog, getNFLSeasonYear } = require("./espn");
const { calibrationBuckets, gameMarketProb } = require("./oddsMath");
const { _internals: { runSimulation } } = require("./seasonSimulator");

const DEFAULT_CHECKPOINTS = [4, 8, 12];
const PLAYOFF_SPOTS_SHARE = 14 / 32;
const MIN_COMPLETED_GAMES = 250;
const CARRYOVER_KEEP = 2 / 3;
const BACKTEST_TTL_MS = 24 * 60 * 60 * 1000;

const NFLVERSE_GAMES_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
// nflverse keeps historical codes; the app uses current franchise codes.
const NFLVERSE_CODES = { LA: "LAR", STL: "LAR", OAK: "LV", SD: "LAC" };

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
 * schedule (optionally with `closingHomeProb` per game), `prior` a code → Elo
 * map, `teams` [{ code, name, conference, division }].
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
  const marketSamples = [];
  const modelOnMarketGames = [];
  const homeFieldProb = eloWinProb(ELO_BASE, ELO_BASE, homeField);
  for (const w of weeks) {
    const { elo } = replayGamesToElo(season.filter((g) => Number(g.week) < w), prior, eloOpts);
    for (const g of season.filter((x) => Number(x.week) === w)) {
      if (g.homeScore === g.awayScore) continue; // ties score as neither
      const h = String(g.homeTeamAbbr).toUpperCase();
      const a = String(g.awayTeamAbbr).toUpperCase();
      const outcome = g.homeScore > g.awayScore ? 1 : 0;
      const hfa = g.neutralSite ? 0 : homeField;
      const prob = eloWinProb(ratingOf(elo, h), ratingOf(elo, a), hfa);
      gameSamples.push({ prob, outcome, week: w });
      homeOnly.push({ prob: g.neutralSite ? 0.5 : homeFieldProb, outcome });
      if (Number.isFinite(g.closingHomeProb)) {
        marketSamples.push({ prob: g.closingHomeProb, outcome });
        modelOnMarketGames.push({ prob, outcome });
      }
    }
  }

  const gamesResult = {
    ...scoreBinary(gameSamples),
    baselines: {
      coinFlip: { brier: 0.25, logLoss: round(Math.log(2)), accuracy: 0.5 },
      homeFieldOnly: scoreBinary(homeOnly),
      vegas: marketSamples.length
        ? { ...scoreBinary(marketSamples), modelOnSameGames: scoreBinary(modelOnMarketGames).brier }
        : null,
    },
    calibration: calibrationBuckets(gameSamples),
    _samples: gameSamples,
    _market: { model: modelOnMarketGames, vegas: marketSamples, home: homeOnly },
  };

  if (!includePlayoffs) {
    return { year, settings: { k, homeField, priorTeams: Object.keys(prior).length }, games: gamesResult };
  }

  /* Playoff level: who actually got in, then forecasts from each checkpoint. */
  const finalElo = replayGamesToElo(season, prior, eloOpts).elo;
  const ratingsAt = (elo) => teams.map((t) => ({ ...t, power: ratingOf(elo, t.code) }));

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
      week,
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
      _samples: playoffSamples,
    },
  };
}

/** Drop the raw sample arrays before a result leaves the service. */
function publicSeason(r) {
  const games = { ...r.games };
  delete games._samples;
  delete games._market;
  const out = { ...r, games };
  if (r.playoffs) {
    out.playoffs = { ...r.playoffs };
    delete out.playoffs._samples;
  }
  return out;
}

/* ── Data sources ──────────────────────────────────────────────────────── */

function parseCsvLine(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** nflverse games.csv text → regular-season games keyed by season. */
function parseNflverseGames(text) {
  const lines = String(text || "").trim().split(/\r?\n/);
  const header = parseCsvLine(lines.shift() || "");
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const code = (c) => NFLVERSE_CODES[c] || c;
  const bySeason = {};
  for (const line of lines) {
    const v = parseCsvLine(line);
    if (v[col.game_type] !== "REG") continue;
    const year = Number(v[col.season]);
    const done = v[col.home_score] !== "";
    const closing = gameMarketProb({
      homeMoneyLine: v[col.home_moneyline],
      awayMoneyLine: v[col.away_moneyline],
      homeSpread: v[col.spread_line] === "" ? null : -Number(v[col.spread_line]),
    });
    (bySeason[year] = bySeason[year] || []).push({
      id: v[col.game_id],
      week: Number(v[col.week]),
      date: v[col.gameday],
      homeTeamAbbr: code(v[col.home_team]),
      awayTeamAbbr: code(v[col.away_team]),
      completed: done,
      homeScore: done ? Number(v[col.home_score]) : 0,
      awayScore: done ? Number(v[col.away_score]) : 0,
      neutralSite: v[col.location] === "Neutral",
      closingHomeProb: Number.isFinite(closing) ? closing : null,
    });
  }
  return bySeason;
}

let _nflverse = null;

function fetchNflverseGames() {
  if (_nflverse && Date.now() - _nflverse.ts < BACKTEST_TTL_MS) return _nflverse.promise;
  const promise = (async () => {
    // A local copy (NFLVERSE_GAMES_FILE) works offline and in CI.
    if (process.env.NFLVERSE_GAMES_FILE) {
      return parseNflverseGames(require("fs").readFileSync(process.env.NFLVERSE_GAMES_FILE, "utf8"));
    }
    const fetch = require("node-fetch");
    const res = await fetch(NFLVERSE_GAMES_URL);
    if (!res.ok) throw new Error(`nflverse games file returned ${res.status}`);
    return parseNflverseGames(await res.text());
  })();
  _nflverse = { promise, ts: Date.now() };
  promise.catch(() => { _nflverse = null; });
  return promise;
}

function catalogTeams() {
  return getNFLTeamCatalog().map((t) => ({
    code: t.abbreviation, name: t.displayName, conference: t.conference, division: t.division,
  }));
}

/** Prior for `year` from the two seasons before it, regressed each offseason. */
function chainedPrior(bySeason, year) {
  let prior = {};
  for (const y of [year - 2, year - 1]) {
    const games = regularSeason(bySeason[y] || []);
    if (games.length < MIN_COMPLETED_GAMES) continue;
    const { elo } = replayGamesToElo(games, prior);
    prior = Object.fromEntries(Object.entries(elo).map(([t, r]) => [t, ELO_BASE + (r - ELO_BASE) * CARRYOVER_KEEP]));
  }
  return prior;
}

async function loadSeasonNflverse(year) {
  const bySeason = await fetchNflverseGames();
  return { games: bySeason[year] || [], prior: chainedPrior(bySeason, year), teams: catalogTeams(), source: "nflverse" };
}

async function loadSeasonEspn(year) {
  const [{ games }, prior, list] = await Promise.all([
    buildLeagueGames(year),
    computeCarryoverPrior(year),
    getNFLTeamList(),
  ]);
  const teams = list.map((t) => {
    const meta = getNFLTeamMetadata(t.code) || {};
    return { code: t.code, name: meta.displayName || t.code, conference: meta.conference, division: meta.division };
  });
  return { games, prior, teams, source: "espn" };
}

async function loadSeason(year) {
  let data = null;
  try {
    data = await loadSeasonNflverse(year);
  } catch (_err) {
    data = null;
  }
  if (!data || regularSeason(data.games).length < MIN_COMPLETED_GAMES) {
    data = await loadSeasonEspn(year);
  }
  const completed = regularSeason(data.games).length;
  if (completed < MIN_COMPLETED_GAMES) {
    throw new Error(`Season ${year} has ${completed} completed regular-season games; a backtest needs a finished season.`);
  }
  return data;
}

/* ── Multi-season report ───────────────────────────────────────────────── */

const _cache = new Map();

/**
 * Backtest a range of finished seasons and pool the scores. Defaults to the
 * last five. Cached for a day; past seasons don't change.
 */
function runBacktest({ from, to, checkpoints = DEFAULT_CHECKPOINTS, iterations = 1500, k, homeField } = {}) {
  const last = to || getNFLSeasonYear() - 1;
  const first = from || last - 4;
  const key = JSON.stringify({ first, last, checkpoints, iterations, k, homeField });
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < BACKTEST_TTL_MS) return cached.promise;

  const promise = (async () => {
    const seasons = [];
    for (let y = first; y <= last; y++) {
      const data = await loadSeason(y);
      seasons.push({ source: data.source, ...backtestFromData({ year: y, ...data, checkpoints, iterations, k, homeField }) });
    }

    const pool = (pick) => seasons.flatMap(pick);
    const model = pool((s) => s.games._samples);
    const vegasModel = pool((s) => s.games._market.model);
    const vegas = pool((s) => s.games._market.vegas);
    const home = pool((s) => s.games._market.home);
    const playoffSamples = pool((s) => s.playoffs._samples);

    const byCheckpoint = checkpoints.map((week) => {
      const samples = playoffSamples.filter((x) => x.week === week);
      return {
        afterWeek: week,
        ...scoreBinary(samples),
        baselineBrier: scoreBinary(samples.map((x) => ({ prob: PLAYOFF_SPOTS_SHARE, outcome: x.outcome }))).brier,
      };
    });

    return {
      from: first,
      to: last,
      sources: [...new Set(seasons.map((s) => s.source))],
      settings: { k: k ?? ELO_K, homeField: homeField ?? ELO_HOME_FIELD, iterations, checkpoints },
      games: {
        ...scoreBinary(model),
        baselines: {
          coinFlip: { brier: 0.25, accuracy: 0.5 },
          homeFieldOnly: scoreBinary(home),
          vegas: vegas.length ? { ...scoreBinary(vegas), modelOnSameGames: scoreBinary(vegasModel).brier } : null,
        },
        calibration: calibrationBuckets(model),
      },
      playoffs: {
        ...scoreBinary(playoffSamples),
        checkpoints: byCheckpoint,
        calibration: calibrationBuckets(playoffSamples, 5),
      },
      seasons: seasons.map(publicSeason),
    };
  })();

  _cache.set(key, { promise, ts: Date.now() });
  promise.catch(() => _cache.delete(key));
  return promise;
}

/**
 * Game-level Brier for every K / home-field pair over a range of seasons,
 * best first. Playoff scoring is skipped: it would multiply the cost and the
 * game-level score already drives it.
 */
async function tuneParameters({ from, to, ks = [16, 20, 24, 28], homeFields = [20, 30, 40, 48] } = {}) {
  const last = to || getNFLSeasonYear() - 1;
  const first = from || last - 4;
  const data = [];
  for (let y = first; y <= last; y++) data.push({ year: y, ...(await loadSeason(y)) });
  const rows = [];
  for (const k of ks) {
    for (const homeField of homeFields) {
      const samples = data.flatMap((d) =>
        backtestFromData({ ...d, k, homeField, includePlayoffs: false }).games._samples
      );
      const s = scoreBinary(samples);
      rows.push({ k, homeField, brier: s.brier, logLoss: s.logLoss, accuracy: s.accuracy });
    }
  }
  return rows.sort((a, b) => a.brier - b.brier);
}

module.exports = {
  DEFAULT_CHECKPOINTS,
  NFLVERSE_GAMES_URL,
  scoreBinary,
  backtestFromData,
  parseNflverseGames,
  chainedPrior,
  runBacktest,
  tuneParameters,
  publicSeason,
};
