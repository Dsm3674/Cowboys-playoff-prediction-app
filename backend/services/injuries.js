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
 * Only depth-chart starters count; a backup's absence is noise. Every piece
 * fails soft: if ESPN is down or reshapes a payload the delta is 0.
 */

const { getNflTeamIdMap, normalizeTeamAbbr } = require("./espn");

const ELO_PER_POINT = 25;
const TEAM_CAP_ELO = 250;
const INJURY_TTL_MS = 30 * 60 * 1000;
const DEPTH_TTL_MS = 6 * 60 * 60 * 1000;
const OFF_CHART_RECENT_DAYS = 21;
const OFF_CHART_WEIGHT = 0.5;

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
    }
  }
  return { byId, byName, available: Object.keys(byId).length + Object.keys(byName).length > 0 };
}

/* ── Scoring ────────────────────────────────────────────────────────────── */

/**
 * Score one team's injuries against its depth chart. `depth` may be null
 * (chart unavailable), in which case every listed injury counts at half
 * weight because starter status is unknown.
 */
function scoreTeamInjuries(injuries = [], depth = null, { now = Date.now() } = {}) {
  const players = [];
  for (const inj of injuries) {
    const pPlay = playProbability(inj.status);
    if (pPlay == null || pPlay >= 1) continue;

    const chart = depth?.available
      ? (inj.athleteId && depth.byId[inj.athleteId]) || depth.byName[inj.name.toLowerCase()] || null
      : null;

    let starterWeight;
    if (!depth?.available) {
      starterWeight = OFF_CHART_WEIGHT;
    } else if (chart) {
      if (chart.rank !== 0) continue;
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

async function computeInjuryDeltas() {
  const teamMap = await getNflTeamIdMap();
  const idToAbbr = {};
  for (const [abbr, t] of Object.entries(teamMap)) idToAbbr[t.id] = abbr;

  const report = parseInjuryReport(await fetchJson(INJURIES_URL), idToAbbr);
  const abbrs = Object.keys(report).filter((a) => teamMap[a]);
  const charts = await Promise.all(abbrs.map((a) => getDepthChart(teamMap[a].id)));

  const byTeam = {};
  abbrs.forEach((abbr, i) => { byTeam[abbr] = scoreTeamInjuries(report[abbr], charts[i]); });
  return { available: true, byTeam, updatedAt: new Date().toISOString() };
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
}

module.exports = {
  ELO_PER_POINT,
  TEAM_CAP_ELO,
  POSITION_POINTS,
  playProbability,
  stalenessWeight,
  parseInjuryReport,
  parseDepthChart,
  scoreTeamInjuries,
  getInjuryDeltas,
  _resetInjuryCache,
};
