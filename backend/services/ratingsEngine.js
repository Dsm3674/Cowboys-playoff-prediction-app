"use strict";

/**
 * ratingsEngine
 * League-wide Elo power ratings rebuilt from season-to-date results.
 *
 * Ratings are replayed from every completed game each time they're requested
 * (behind a short cache), so a new week of results is folded in automatically —
 * no manual weekly batch job. On top of the pure results-based Elo sits a
 * persisted adjustment layer for news that results can't see yet: QB outs,
 * injury clusters, trades. Adjustments are Elo-point deltas with a reason and
 * an optional expiry week.
 *
 * Elo spec (FiveThirtyEight-style):
 *   base 1500, K = 20, home field = +48 Elo pts,
 *   margin-of-victory multiplier ln(|margin|+1) * 2.2 / (0.001*winnerEloDiff + 2.2)
 */

const fs = require("fs");
const path = require("path");

const {
  getNFLSeasonYear,
  getNFLTeamList,
  getNFLTeamMetadata,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
} = require("./espn");
const { computeTSI } = require("../tsi");

const ELO_BASE = 1500;
const ELO_K = 20;
const ELO_HOME_FIELD = 48;
const ADJUSTMENT_LIMIT = 150; // max |Elo delta| a single adjustment may apply
const RATINGS_TTL_MS = 10 * 60 * 1000;

const ADJUSTMENTS_FILE = path.join(__dirname, "..", "Data", "rating_adjustments.json");

/* ── Elo math ──────────────────────────────────────────────────────────── */

function eloWinProb(eloA, eloB, homeFieldForA = 0) {
  return 1 / (1 + Math.pow(10, -(eloA + homeFieldForA - eloB) / 400));
}

function movMultiplier(margin, winnerEloDiff) {
  const m = Math.max(1, Math.abs(margin));
  return Math.log(m + 1) * (2.2 / (winnerEloDiff * 0.001 + 2.2));
}

/**
 * Replay completed games (chronological) into an Elo table.
 * `games` entries need: homeTeamAbbr, awayTeamAbbr, homeScore, awayScore,
 * completed, date. Unknown teams are lazily seeded at ELO_BASE, or at their
 * entry in `initialElo` when a preseason prior is supplied.
 */
function replayGamesToElo(games, initialElo = {}) {
  const elo = {};
  const rated = [];
  const get = (abbr) => {
    if (!(abbr in elo)) elo[abbr] = initialElo[abbr] ?? ELO_BASE;
    return elo[abbr];
  };

  const completed = games
    .filter((g) => g.completed && g.homeTeamAbbr && g.awayTeamAbbr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const g of completed) {
    const home = String(g.homeTeamAbbr).toUpperCase();
    const away = String(g.awayTeamAbbr).toUpperCase();
    const eloHome = get(home);
    const eloAway = get(away);

    const pHome = eloWinProb(eloHome, eloAway, ELO_HOME_FIELD);
    const margin = (g.homeScore || 0) - (g.awayScore || 0);
    const actualHome = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;

    const winnerEloDiff =
      margin >= 0
        ? eloHome + ELO_HOME_FIELD - eloAway
        : eloAway - (eloHome + ELO_HOME_FIELD);

    const shift = ELO_K * movMultiplier(margin, winnerEloDiff) * (actualHome - pHome);
    elo[home] = eloHome + shift;
    elo[away] = eloAway - shift;
    rated.push({ id: g.id, week: g.week, home, away, shift: Number(shift.toFixed(2)) });
  }

  return { elo, ratedGames: rated };
}

/* ── Adjustment layer (QB / injury / trade news) ───────────────────────── */

function readAdjustmentsFile() {
  try {
    const raw = fs.readFileSync(ADJUSTMENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeAdjustmentsFile(list) {
  fs.mkdirSync(path.dirname(ADJUSTMENTS_FILE), { recursive: true });
  fs.writeFileSync(ADJUSTMENTS_FILE, JSON.stringify(list, null, 2));
}

function normalizeAdjustment(input = {}) {
  const team = String(input.team || "").toUpperCase().trim();
  if (!/^[A-Z]{2,4}$/.test(team)) throw new Error("Invalid team abbreviation.");

  const delta = Number(input.deltaElo);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("deltaElo must be a non-zero number.");

  const reason = String(input.reason || "").trim().slice(0, 200);
  if (!reason) throw new Error("A reason is required (e.g. 'QB1 out, backup starts').");

  const tag = ["QB", "INJURY", "TRADE", "OTHER"].includes(String(input.tag || "").toUpperCase())
    ? String(input.tag).toUpperCase()
    : "OTHER";

  const expiresWeek =
    input.expiresWeek == null ? null : Math.max(1, Math.min(22, Number(input.expiresWeek) || 0)) || null;

  return {
    team,
    deltaElo: Math.max(-ADJUSTMENT_LIMIT, Math.min(ADJUSTMENT_LIMIT, delta)),
    reason,
    tag,
    expiresWeek,
    updatedAt: new Date().toISOString(),
  };
}

function listAdjustments() {
  return readAdjustmentsFile();
}

function upsertAdjustment(input) {
  const adj = normalizeAdjustment(input);
  const list = readAdjustmentsFile().filter((a) => a.team !== adj.team || a.tag !== adj.tag);
  list.push(adj);
  writeAdjustmentsFile(list);
  return adj;
}

function removeAdjustments(team) {
  const abbr = String(team || "").toUpperCase();
  const list = readAdjustmentsFile();
  const kept = list.filter((a) => a.team !== abbr);
  writeAdjustmentsFile(kept);
  return list.length - kept.length;
}

function activeAdjustmentTotal(team, adjustments, currentWeek) {
  return adjustments
    .filter((a) => a.team === team)
    .filter((a) => a.expiresWeek == null || currentWeek == null || currentWeek <= a.expiresWeek)
    .reduce((sum, a) => sum + a.deltaElo, 0);
}

/* ── League table ──────────────────────────────────────────────────────── */

async function buildLeagueGames(year) {
  const teams = await getNFLTeamList();
  const schedules = await Promise.all(
    teams.map((t) => fetchTeamGamesSeasonToDate(t.code, year))
  );

  const seen = new Set();
  const games = [];
  for (const schedule of schedules) {
    for (const g of schedule) {
      const key = g.id || `${g.date}:${g.homeTeamAbbr}:${g.awayTeamAbbr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      games.push(g);
    }
  }
  return { teams, games, schedules };
}

/**
 * Preseason prior: last season's final Elo regressed one-third back toward
 * the 1500 mean (the classic FiveThirtyEight carryover). Keeps early-season
 * and offseason ratings meaningful instead of a flat 1500 for everyone.
 */
async function computePreseasonPrior(year) {
  try {
    const { games } = await buildLeagueGames(year - 1);
    const { elo, ratedGames } = replayGamesToElo(games);
    if (ratedGames.length < 100) return {}; // partial prior season — skip
    const prior = {};
    for (const [team, rating] of Object.entries(elo)) {
      prior[team] = ELO_BASE + (rating - ELO_BASE) * (2 / 3);
    }
    return prior;
  } catch (_err) {
    return {};
  }
}

/**
 * Full power-rating table: results-based Elo (seeded from a regressed
 * prior-season carryover), news adjustments, and an efficiency overlay from
 * per-game point differential (an EPA-lite proxy — true play-by-play EPA
 * needs pbp data ESPN's public schedule feed lacks).
 */
async function computePowerRatings({ year } = {}) {
  const resolvedYear = year || getNFLSeasonYear();
  const [{ teams, games, schedules }, prior] = await Promise.all([
    buildLeagueGames(resolvedYear),
    computePreseasonPrior(resolvedYear),
  ]);
  const { elo, ratedGames } = replayGamesToElo(games, prior);
  const adjustments = listAdjustments();

  const lastCompletedWeek = games
    .filter((g) => g.completed)
    .reduce((max, g) => Math.max(max, g.week || 0), 0) || null;

  // TSI flows back into the power score (the engines cross-pollinate both
  // ways: Elo feeds the legacy models, TSI feeds the Elo power number).
  const tsiResults = await Promise.allSettled(
    teams.map((team) => computeTSI({ teamAbbr: team.code, year: resolvedYear }))
  );

  const rows = teams.map((team, i) => {
    const meta = getNFLTeamMetadata(team.code) || {};
    const teamGames = schedules[i] || [];
    const record = computeRecordFromGames(teamGames, team.code);
    const averages = computeTeamAveragesFromGames(team.code, teamGames);

    const baseElo = elo[team.code] ?? prior[team.code] ?? ELO_BASE;
    const newsDelta = activeAdjustmentTotal(team.code, adjustments, lastCompletedWeek);
    const adjustedElo = baseElo + newsDelta;

    // Efficiency overlay: ±14 pts/game differential maps to ±42 Elo.
    const efficiencyDelta = Math.max(-14, Math.min(14, averages.pointDiffPerGame || 0)) * 3;

    // TSI overlay: 50 is league-neutral; ±25 TSI maps to ±30 Elo.
    const tsiValue =
      tsiResults[i].status === "fulfilled" ? Number(tsiResults[i].value?.tsi) : NaN;
    const tsiDelta = Number.isFinite(tsiValue)
      ? Math.max(-25, Math.min(25, tsiValue - 50)) * 1.2
      : 0;

    return {
      code: team.code,
      name: meta.displayName || team.code,
      conference: meta.conference || "Unknown",
      division: meta.division || "Unknown",
      record,
      pointDiffPerGame: Number((averages.pointDiffPerGame || 0).toFixed(1)),
      elo: Number(baseElo.toFixed(1)),
      newsDelta: Number(newsDelta.toFixed(1)),
      adjustedElo: Number(adjustedElo.toFixed(1)),
      efficiencyDelta: Number(efficiencyDelta.toFixed(1)),
      tsi: Number.isFinite(tsiValue) ? Number(tsiValue.toFixed(1)) : null,
      tsiDelta: Number(tsiDelta.toFixed(1)),
      power: Number((adjustedElo + efficiencyDelta + tsiDelta).toFixed(1)),
      adjustments: adjustments.filter((a) => a.team === team.code),
    };
  });

  rows.sort((a, b) => b.power - a.power);
  rows.forEach((row, i) => { row.rank = i + 1; });

  return {
    year: resolvedYear,
    system: "Elo v2 · K=20 · MOV-weighted · HFA +48 · ⅓-regressed carryover · TSI overlay",
    lastCompletedWeek,
    gamesRated: ratedGames.length,
    updatedAt: new Date().toISOString(),
    cadence: "Ratings replay all completed games on request; news deltas applied live.",
    ratings: rows,
  };
}

/* Promise cache so a burst of requests replays the league once. */
const _ratingsCache = new Map();

function getPowerRatings({ year } = {}) {
  const resolvedYear = year || getNFLSeasonYear();
  const cached = _ratingsCache.get(resolvedYear);
  if (cached && Date.now() - cached.ts < RATINGS_TTL_MS) return cached.promise;

  const promise = computePowerRatings({ year: resolvedYear });
  _ratingsCache.set(resolvedYear, { promise, ts: Date.now() });
  promise.catch(() => _ratingsCache.delete(resolvedYear));
  return promise;
}

function _invalidateRatingsCache() {
  _ratingsCache.clear();
}

/* ── Cross-engine hybrid layer ─────────────────────────────────────────── */

/**
 * Lightweight Elo lookup for the legacy prediction engines. `available` is
 * false when the league is a flat 1500 wall (ESPN unreachable and no prior),
 * so callers can skip blending rather than dilute their own signal with noise.
 */
async function getEloSnapshot({ year } = {}) {
  try {
    const ratings = await getPowerRatings({ year });
    const byTeam = {};
    let informative = false;
    for (const t of ratings.ratings) {
      byTeam[t.code] = { adjustedElo: t.adjustedElo, power: t.power };
      if (Math.abs(t.power - ELO_BASE) > 1) informative = true;
    }
    return {
      available: informative,
      byTeam,
      lastCompletedWeek: ratings.lastCompletedWeek,
    };
  } catch (_err) {
    return { available: false, byTeam: {} };
  }
}

/**
 * Mix a legacy model probability with the Elo probability in logit space.
 * weight 0 → pure legacy, 1 → pure Elo. Non-finite eloProb passes the
 * base through untouched so callers don't need their own guards.
 */
function blendWithElo(baseProb, eloProb, weight = 0.5) {
  if (!Number.isFinite(eloProb)) return baseProb;
  const w = Math.max(0, Math.min(1, weight));
  const clamp01 = (p) => Math.max(0.02, Math.min(0.98, Number(p) || 0.5));
  const logit = (p) => Math.log(clamp01(p) / (1 - clamp01(p)));
  const z = (1 - w) * logit(baseProb) + w * logit(eloProb);
  return 1 / (1 + Math.exp(-z));
}

module.exports = {
  ELO_BASE,
  ELO_HOME_FIELD,
  eloWinProb,
  movMultiplier,
  replayGamesToElo,
  listAdjustments,
  upsertAdjustment,
  removeAdjustments,
  getPowerRatings,
  computePowerRatings,
  getEloSnapshot,
  blendWithElo,
  _invalidateRatingsCache,
};
