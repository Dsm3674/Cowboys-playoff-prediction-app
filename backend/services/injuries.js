"use strict";

/**
 * injuries
 * Automatic injury Elo deltas from ESPN's public injury report + depth charts.
 *
 * Per player:  (1 - P(plays)) × positional value (spread pts) × 25 Elo/pt × staleness
 *
 *   P(plays)          Out / IR / PUP / suspended 0, Doubtful 0.1, Questionable 0.75
 *                     (~75% of Questionables have played since the 2016 report
 *                     change — Football Outsiders, Binney).
 *   positional value  Market consensus on how far a line moves when a starter
 *                     sits: QB 3–7 pts, elite edge / CB 0.5–1.5, most others
 *                     less. Relative ordering follows the franchise-tag weights
 *                     that Glazer, Binney & Seth (2025) found best tracked
 *                     betting-line injury burden (wAGL).
 *   25 Elo / pt       FiveThirtyEight's spread-to-Elo conversion.
 *   staleness         Results-based Elo absorbs a long absence on its own, so
 *                     weight fades from 100% (≤2 weeks) to 25% (≥8 weeks).
 *
 * That gives the cost for the *next* game. Season projections apply one
 * rating to every remaining game, so seasonDelta() spreads each player's cost
 * over the games he's expected to miss: ESPN's return date when given, else
 * 4 for IR/PUP/NFI (the minimum stint) and 1 for game-status designations.
 *
 * Only starters count; a backup's absence is noise. Every piece fails soft:
 * if ESPN is down or reshapes a payload the delta is 0.
 *
 * Three ESPN sources are merged per team:
 *   league injury report  newest 25 items per team, most of them news notes;
 *                         carries the injury detail and expected return date.
 *   team roster           every player's current designation, however old,
 *                         plus salary. This is what catches a starter who went
 *                         on IR a month ago and has left the league report.
 *   depth chart           playing order. ESPN lists healthy players first, so
 *                         an injured starter sits below his replacement.
 *
 * A starter is whoever tops his slot. A player listed lower who cannot play
 * also counts when he is the first unavailable name at the slot and is paid
 * at least DISPLACED_SALARY_RATIO times the man now starting: the replacement
 * was promoted over him by the injury, not by merit. Quarterbacks need a
 * higher bar (see DISPLACED_QB_*).
 */

const { getNflTeamIdMap, normalizeTeamAbbr } = require("./espn");

const ELO_PER_POINT = 25;
const TEAM_CAP_ELO = 250;
const INJURY_TTL_MS = 30 * 60 * 1000;
const DEPTH_TTL_MS = 6 * 60 * 60 * 1000;
const OFF_CHART_RECENT_DAYS = 21;
const OFF_CHART_WEIGHT = 0.5;
const ROSTER_TTL_MS = 30 * 60 * 1000;
const DISPLACED_SALARY_RATIO = 1.5;
/* A quarterback is worth five times any other position, so a wrong call is
   costly, and starters on rookie deals are often paid less than a veteran
   backup. Only a clear franchise contract counts. */
const DISPLACED_QB_SALARY_RATIO = 2;
const DISPLACED_QB_MIN_SALARY = 10000000;
/* Game-status tags are reissued weekly; an old one the league report no
   longer mentions is a leftover, not a current designation. */
const STALE_GAME_STATUS_DAYS = 8;
/* An "Out" that has stood this long is a long-term absence (PUP, NFI). */
const LONG_OUT_DAYS = 10;
const rosterUrl = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;

const INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const depthUrl = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/depthcharts`;

/* Spread points a team loses when this starter sits. */
const POSITION_POINTS = {
  QB: 4.5,
  DE: 1.0, OLB: 1.0, EDGE: 1.0,
  WR: 0.8,
  CB: 0.7,
  OT: 0.6, T: 0.6,
  DT: 0.6, NT: 0.6, DL: 0.6,
  LB: 0.5, ILB: 0.5, MLB: 0.5,
  S: 0.5, SS: 0.5, FS: 0.5, DB: 0.5,
  TE: 0.5,
  RB: 0.4,
  G: 0.4, OG: 0.4, C: 0.4, OL: 0.4,
  PK: 0.3, K: 0.3,
  FB: 0.1, P: 0.1,
  LS: 0.05,
};

/* Blind-side tackle is priced above the right side. */
const SLOT_POINTS = { lt: 0.9 };

/* Special-teams slots whose starters matter; the rest (returners, holder) don't. */
const ST_SLOTS = new Set(["pk", "k", "p", "ls"]);

function playProbability(status) {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("injured reserve") || s === "ir" || s.includes("ir-")) return 0;
  if (s.includes("out") || s.includes("pup") || s.includes("suspen")) return 0;
  if (s.includes("physically unable") || s.includes("non-football")) return 0;
  if (s.includes("doubtful")) return 0.1;
  if (s.includes("questionable")) return 0.75;
  if (s.includes("day-to-day") || s.includes("day to day")) return 0.85;
  if (s.includes("probable")) return 0.95;
  return null;
}

/* 1.0 through two weeks, linear to 0.25 at eight weeks and beyond. */
function stalenessWeight(injuryDate, now = Date.now()) {
  const t = Date.parse(injuryDate);
  if (!Number.isFinite(t)) return 1;
  const weeks = Math.max(0, (now - t) / (7 * 24 * 60 * 60 * 1000));
  if (weeks <= 2) return 1;
  if (weeks >= 8) return 0.25;
  return 1 - ((weeks - 2) / 6) * 0.75;
}

const LONG_TERM_MIN_GAMES = 4;

/* Games a player is expected to miss, counting the next one. */
function expectedGamesOut(inj, now = Date.now()) {
  const ret = Date.parse(inj?.returnDate);
  if (Number.isFinite(ret) && ret > now) {
    return Math.max(1, Math.ceil((ret - now) / (7 * 86400000)));
  }
  const s = String(inj?.status || "").toLowerCase();
  if (s.includes("injured reserve") || s === "ir" || s.includes("pup") ||
      s.includes("physically unable") || s.includes("non-football")) {
    return LONG_TERM_MIN_GAMES;
  }
  const since = Date.parse(inj?.date);
  if (s.includes("out") && Number.isFinite(since) && now - since > LONG_OUT_DAYS * 86400000) {
    return LONG_TERM_MIN_GAMES;
  }
  return 1;
}

/* ── Payload parsing (defensive: ESPN's shapes are undocumented) ────────── */

function teamAbbrFromEntry(entry, idToAbbr) {
  const direct = entry?.abbreviation || entry?.team?.abbreviation;
  if (direct) return normalizeTeamAbbr(direct, "");
  const id = entry?.id ?? entry?.team?.id;
  return id != null ? idToAbbr[String(id)] || "" : "";
}

/**
 * League injury report → { ABBR: [{ athleteId, name, position, status, date }] }.
 * Accepts the league payload ({ injuries: [{ id, injuries: [...] }] }) or a
 * flat list of rows carrying their own athlete.team.
 */
function parseInjuryReport(payload, idToAbbr = {}) {
  const out = {};
  const push = (abbr, row) => {
    const athlete = row?.athlete || {};
    const position = String(
      athlete.position?.abbreviation || athlete.position?.name || row?.position || ""
    ).toUpperCase();
    const status = row?.status || row?.type?.description || row?.fantasyStatus?.description;
    if (!abbr || !status) return;
    (out[abbr] = out[abbr] || []).push({
      athleteId: athlete.id != null ? String(athlete.id) : null,
      name: athlete.displayName || athlete.fullName || "Unknown",
      position,
      status: String(status),
      date: row?.date || null,
      detail: row?.details?.type || row?.shortComment || null,
      returnDate: row?.details?.returnDate || null,
    });
  };

  const groups = Array.isArray(payload?.injuries) ? payload.injuries : [];
  for (const group of groups) {
    if (Array.isArray(group?.injuries)) {
      const abbr = teamAbbrFromEntry(group, idToAbbr);
      for (const row of group.injuries) {
        push(abbr || teamAbbrFromEntry(row?.athlete?.team, idToAbbr), row);
      }
    } else if (group?.athlete) {
      push(teamAbbrFromEntry(group.athlete.team, idToAbbr), group);
    }
  }
  return out;
}

/**
 * Team depth chart → { byId, byName } of each athlete's best depth rank
 * (0 = starter) and the slot where they hold it.
 */
function parseDepthChart(payload) {
  const byId = {};
  const byName = {};
  const slots = {};
  const formations = payload?.depthchart || payload?.depthCharts || payload?.items || [];
  const note = (athlete, rank, slot) => {
    if (!athlete) return;
    const entry = { rank, slot };
    const id = athlete.id != null ? String(athlete.id) : null;
    const name = String(athlete.displayName || athlete.fullName || "").toLowerCase();
    if (id && (!byId[id] || byId[id].rank > rank)) byId[id] = entry;
    if (name && (!byName[name] || byName[name].rank > rank)) byName[name] = entry;
  };

  for (const formation of Array.isArray(formations) ? formations : []) {
    const positions = formation?.positions || {};
    for (const [slotKey, slot] of Object.entries(positions)) {
      const key = slotKey.toLowerCase();
      const special = /special/i.test(formation?.name || "");
      if (special && !ST_SLOTS.has(key)) continue;
      const athletes = Array.isArray(slot?.athletes) ? slot.athletes : [];
      athletes.forEach((a, i) => note(a?.athlete || a, Number(a?.rank) > 0 ? a.rank - 1 : i, key));
      if (!slots[key]) {
        slots[key] = athletes.map((a) => {
          const who = a?.athlete || a || {};
          return {
            id: who.id != null ? String(who.id) : null,
            name: String(who.displayName || who.fullName || "").toLowerCase(),
          };
        });
      }
    }
  }
  return { byId, byName, slots, available: Object.keys(byId).length + Object.keys(byName).length > 0 };
}

/**
 * Team roster → { injured: [rows shaped like parseInjuryReport's], salaryById,
 * salaryByName }. Practice-squad players are left out: they were never
 * playing on Sunday.
 */
function parseRoster(payload) {
  const injured = [];
  const salaryById = {};
  const salaryByName = {};
  const groups = Array.isArray(payload?.athletes) ? payload.athletes : [];
  for (const group of groups) {
    const items = Array.isArray(group?.items) ? group.items : group?.id ? [group] : [];
    for (const a of items) {
      const id = a?.id != null ? String(a.id) : null;
      const name = a?.displayName || a?.fullName || "";
      const salary = Number(a?.contract?.salary) || 0;
      if (salary > 0) {
        if (id) salaryById[id] = salary;
        if (name) salaryByName[name.toLowerCase()] = salary;
      }
      if (/practice/i.test(a?.status?.type || a?.status?.name || "")) continue;
      const inj = Array.isArray(a?.injuries) ? a.injuries[0] : null;
      if (!inj?.status || !name) continue;
      injured.push({
        athleteId: id,
        name,
        position: String(a?.position?.abbreviation || "").toUpperCase(),
        status: String(inj.status),
        date: inj.date || null,
        detail: null,
        returnDate: null,
      });
    }
  }
  return { injured, salaryById, salaryByName, available: groups.length > 0 };
}

/**
 * One team's injury list from the league report and its roster. The report
 * wins where both mention a player (it is newer and carries the detail); the
 * roster adds everyone the report has dropped.
 */
function mergeInjuries(reportRows = [], rosterRows = [], { now = Date.now() } = {}) {
  const byName = new Map();
  for (const row of reportRows) {
    const key = row.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { ...row });
  }
  for (const row of rosterRows) {
    const key = row.name.toLowerCase();
    const seen = byName.get(key);
    if (seen) {
      if (!seen.athleteId) seen.athleteId = row.athleteId;
      if (!seen.position) seen.position = row.position;
      // A news note older than the roster's designation says nothing about it.
      const note = playProbability(seen.status) == null;
      if (!(note && Date.parse(row.date) > Date.parse(seen.date))) continue;
      byName.delete(key);
    }
    const p = playProbability(row.status);
    if (p == null) continue;
    const t = Date.parse(row.date);
    const ageDays = Number.isFinite(t) ? (now - t) / 86400000 : 0;
    if (p > 0 && ageDays > STALE_GAME_STATUS_DAYS) continue;
    byName.set(key, { ...row });
  }
  return [...byName.values()];
}

/**
 * True when a player listed below the top of his slot is the starter the
 * injury displaced: nobody unavailable is listed above him there, and he is
 * paid well above the man now starting.
 */
function isDisplacedStarter(inj, depth, salaries, unavailable) {
  if (!salaries || !depth?.slots) return false;
  const name = inj.name.toLowerCase();
  const pay = (p) => (p.id && salaries.salaryById?.[p.id]) || salaries.salaryByName?.[p.name] || 0;
  const is = (p) => (inj.athleteId && p.id === inj.athleteId) || p.name === name;

  for (const order of Object.values(depth.slots)) {
    const at = order.findIndex(is);
    if (at <= 0) continue;
    const above = order.slice(0, at);
    if (above.some((p) => unavailable.has(p.name))) continue;
    const mine = pay(order[at]);
    const starters = pay(above[0]);
    if (!(mine > 0 && starters > 0)) continue;
    if (inj.position === "QB") {
      if (mine >= DISPLACED_QB_MIN_SALARY && mine >= starters * DISPLACED_QB_SALARY_RATIO) return true;
    } else if (mine >= starters * DISPLACED_SALARY_RATIO) {
      return true;
    }
  }
  return false;
}

/* ── Scoring ────────────────────────────────────────────────────────────── */

/**
 * Score one team's injuries against its depth chart. `depth` may be null
 * (chart unavailable), in which case every listed injury counts at half
 * weight because starter status is unknown.
 */
function scoreTeamInjuries(injuries = [], depth = null, { now = Date.now(), salaries = null } = {}) {
  const players = [];
  const unavailable = new Set(
    injuries.filter((i) => playProbability(i.status) === 0).map((i) => i.name.toLowerCase())
  );
  const isRecent = (inj) => {
    const t = Date.parse(inj.date);
    return !Number.isFinite(t) || now - t <= OFF_CHART_RECENT_DAYS * 86400000;
  };
  for (const inj of injuries) {
    const pPlay = playProbability(inj.status);
    if (pPlay == null || pPlay >= 1) continue;

    const chart = depth?.available
      ? (inj.athleteId && depth.byId[inj.athleteId]) || depth.byName[inj.name.toLowerCase()] || null
      : null;

    let starterWeight;
    if (!depth?.available) {
      if (!isRecent(inj)) continue;
      starterWeight = OFF_CHART_WEIGHT;
    } else if (chart) {
      const displaced =
        chart.rank !== 0 && pPlay === 0 && isDisplacedStarter(inj, depth, salaries, unavailable);
      if (chart.rank !== 0 && !displaced) continue;
      starterWeight = 1;
    } else {
      // ESPN often drops IR'd starters from the chart. Count a recent
      // off-chart injury at half weight; skip QBs, whose charts are reliable
      // and whose backups would otherwise be priced as starters.
      const t = Date.parse(inj.date);
      const recent = Number.isFinite(t) && now - t <= OFF_CHART_RECENT_DAYS * 86400000;
      if (!recent || inj.position === "QB") continue;
      starterWeight = OFF_CHART_WEIGHT;
    }

    const points = (chart && SLOT_POINTS[chart.slot]) || POSITION_POINTS[inj.position];
    if (!points) continue;

    const staleness = stalenessWeight(inj.date, now);
    const elo = -(1 - pPlay) * points * ELO_PER_POINT * staleness * starterWeight;
    if (elo === 0) continue;

    players.push({
      name: inj.name,
      position: inj.position,
      status: inj.status,
      detail: inj.detail,
      elo: Number(elo.toFixed(1)),
      gamesOut: expectedGamesOut(inj, now),
      starter: starterWeight === 1,
    });
  }

  players.sort((a, b) => a.elo - b.elo);
  const raw = players.reduce((s, p) => s + p.elo, 0);
  return {
    delta: Number(Math.max(-TEAM_CAP_ELO, raw).toFixed(1)),
    capped: raw < -TEAM_CAP_ELO,
    players,
  };
}

/**
 * Average per-game injury cost across a team's remaining schedule: each
 * player's next-game cost × share of remaining games he's expected to miss.
 */
function seasonDelta(players = [], remainingGames = 0) {
  const n = Math.floor(Number(remainingGames) || 0);
  if (n <= 0) return 0;
  const raw = players.reduce((sum, p) => sum + p.elo * Math.min(p.gamesOut || 1, n) / n, 0);
  return Number(Math.max(-TEAM_CAP_ELO, raw).toFixed(1));
}

/* ── Fetching ───────────────────────────────────────────────────────────── */

async function fetchJson(url) {
  const fetch = require("node-fetch");
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json();
}

const _depthCache = new Map();

async function getDepthChart(teamId) {
  const hit = _depthCache.get(teamId);
  if (hit && Date.now() - hit.ts < DEPTH_TTL_MS) return hit.value;
  let value = null;
  try {
    value = parseDepthChart(await fetchJson(depthUrl(teamId)));
  } catch (err) {
    console.warn(`[injuries] depth chart ${teamId} unavailable: ${err.message}`);
  }
  _depthCache.set(teamId, { value, ts: Date.now() });
  return value;
}

const _rosterCache = new Map();

async function getRoster(teamId) {
  const hit = _rosterCache.get(teamId);
  if (hit && Date.now() - hit.ts < ROSTER_TTL_MS) return hit.value;
  let value = null;
  try {
    value = parseRoster(await fetchJson(rosterUrl(teamId)));
  } catch (err) {
    console.warn(`[injuries] roster ${teamId} unavailable: ${err.message}`);
  }
  _rosterCache.set(teamId, { value, ts: Date.now() });
  return value;
}

async function computeInjuryDeltas() {
  const teamMap = await getNflTeamIdMap();
  const idToAbbr = {};
  for (const [abbr, t] of Object.entries(teamMap)) idToAbbr[t.id] = abbr;

  const report = parseInjuryReport(await fetchJson(INJURIES_URL), idToAbbr);
  const abbrs = Object.keys(teamMap);
  const [charts, rosters] = await Promise.all([
    Promise.all(abbrs.map((a) => getDepthChart(teamMap[a].id))),
    Promise.all(abbrs.map((a) => getRoster(teamMap[a].id))),
  ]);

  const byTeam = {};
  abbrs.forEach((abbr, i) => {
    const roster = rosters[i]?.available ? rosters[i] : null;
    const injuries = mergeInjuries(report[abbr] || [], roster?.injured || []);
    byTeam[abbr] = scoreTeamInjuries(injuries, charts[i], { salaries: roster });
  });
  const rostersOk = rosters.filter((r) => r?.available).length;
  return {
    available: true,
    byTeam,
    rosterCoverage: `${rostersOk}/${abbrs.length}`,
    updatedAt: new Date().toISOString(),
  };
}

let _cache = null;

/**
 * Cached league-wide injury deltas. Never throws: on any failure returns
 * { available: false, byTeam: {} } so ratings fall back to zero adjustment.
 */
function getInjuryDeltas() {
  if (_cache && Date.now() - _cache.ts < INJURY_TTL_MS) return _cache.promise;
  const promise = computeInjuryDeltas().catch((err) => {
    console.warn(`[injuries] report unavailable, using zero deltas: ${err.message}`);
    _cache = null;
    return { available: false, byTeam: {}, error: err.message };
  });
  _cache = { promise, ts: Date.now() };
  return promise;
}

function _resetInjuryCache() {
  _cache = null;
  _depthCache.clear();
  _rosterCache.clear();
}

module.exports = {
  ELO_PER_POINT,
  TEAM_CAP_ELO,
  POSITION_POINTS,
  playProbability,
  stalenessWeight,
  expectedGamesOut,
  seasonDelta,
  parseInjuryReport,
  parseDepthChart,
  parseRoster,
  mergeInjuries,
  scoreTeamInjuries,
  getInjuryDeltas,
  _resetInjuryCache,
};
