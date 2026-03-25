"use strict";

const db = require("./databases");

const DEFAULT_SEASON = new Date().getUTCFullYear();
const MAX_EVENTS = 5000;
const ALLOWED_EVENT_TYPES = new Set([
  "injury",
  "absence",
  "suspension",
  "downgrade",
  "upgrade",
  "return",
  "boost",
  "loss",
  "win",
  "missed_game",
  "availability",
  "status_change",
  "performance",
  "transaction"
]);

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeSeason(value) {
  const year = parseInt(value, 10);
  if (!Number.isInteger(year)) return DEFAULT_SEASON;
  if (year < 2000) return DEFAULT_SEASON;
  if (year > DEFAULT_SEASON + 1) return DEFAULT_SEASON;
  return year;
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValidDate(d) ? d : null;
}

function toIsoDay(value) {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function toIsoTimestamp(value) {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(asNumber(value, 0) * factor) / factor;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEventType(value) {
  const type = asString(value).toLowerCase().replace(/\s+/g, "_");
  if (!type) return "unknown";
  return ALLOWED_EVENT_TYPES.has(type) ? type : type;
}

function inferDirectionFromType(type) {
  if (["injury", "absence", "suspension", "downgrade", "loss", "missed_game"].includes(type)) {
    return -1;
  }
  if (["upgrade", "return", "boost", "win", "availability", "status_change", "performance", "transaction"].includes(type)) {
    return 1;
  }
  return 0;
}

function classifySeverity(rawImpact) {
  const value = Math.abs(asNumber(rawImpact, 0));
  if (value >= 8) return "critical";
  if (value >= 5) return "high";
  if (value >= 2.5) return "medium";
  if (value > 0) return "low";
  return "none";
}

function normalizeImpact(eventType, impactScore) {
  const raw = asNumber(impactScore, 0);
  const type = normalizeEventType(eventType);
  if (raw === 0) return 0;
  if (raw < 0) return raw;
  const direction = inferDirectionFromType(type);
  if (direction === 0) return raw;
  return round(Math.abs(raw) * direction, 2);
}

function normalizePlayerName(row) {
  const first = asString(row.first_name);
  const last = asString(row.last_name);
  const full = asString(row.player_name);
  if (full) return full;
  return [first, last].filter(Boolean).join(" ").trim() || null;
}

function normalizeRawRow(row) {
  const raw = safeObject(row);
  const eventType = normalizeEventType(raw.event_type);
  const eventDate = toIsoDay(raw.event_date);
  const impact = normalizeImpact(eventType, raw.impact_score);
  const title = asString(raw.title) || eventType.replace(/_/g, " ");
  const detail = asString(raw.detail || raw.description || raw.message);
  const team = asString(raw.team_abbr || raw.team || raw.club).toUpperCase() || null;
  const playerId = raw.player_id !== undefined && raw.player_id !== null ? String(raw.player_id) : null;
  const playerName = normalizePlayerName(raw);
  const source = asString(raw.source || raw.provider || "database");
  const category = asString(raw.category || raw.event_category || eventType);
  const confidence = Math.max(0, Math.min(1, asNumber(raw.confidence, 1)));
  const severity = classifySeverity(impact);

  return {
    id: raw.id !== undefined && raw.id !== null ? String(raw.id) : `${eventDate || "unknown"}:${eventType}:${playerId || "team"}`,
    eventDate,
    eventTimestamp: toIsoTimestamp(raw.event_date),
    eventType,
    impact,
    title,
    detail: detail || null,
    team,
    playerId,
    playerName,
    source,
    category,
    confidence: round(confidence, 4),
    severity,
    metadata: safeObject(raw.metadata)
  };
}

function isRowUsable(row) {
  if (!row) return false;
  if (!row.eventDate) return false;
  if (!Number.isFinite(row.impact)) return false;
  return true;
}

function compareEvents(a, b) {
  const at = a.eventTimestamp || a.eventDate || "";
  const bt = b.eventTimestamp || b.eventDate || "";
  if (at < bt) return -1;
  if (at > bt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function dedupeEvents(events) {
  const seen = new Set();
  const out = [];
  for (const event of safeArray(events)) {
    const key = [
      event.id,
      event.eventDate,
      event.eventType,
      event.playerId,
      event.team,
      event.impact
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

function aggregatePointsByDay(events) {
  const map = new Map();

  for (const event of safeArray(events)) {
    if (!event.eventDate) continue;
    const existing = map.get(event.eventDate) || {
      date: event.eventDate,
      value: 0,
      positive: 0,
      negative: 0,
      count: 0,
      eventTypes: new Set(),
      players: new Set(),
      teams: new Set()
    };

    existing.value += event.impact;
    existing.count += 1;
    existing.eventTypes.add(event.eventType);

    if (event.playerName) existing.players.add(event.playerName);
    if (event.team) existing.teams.add(event.team);

    if (event.impact >= 0) {
      existing.positive += event.impact;
    } else {
      existing.negative += event.impact;
    }

    map.set(event.eventDate, existing);
  }

  return Array.from(map.values())
    .map((point) => ({
      date: point.date,
      value: round(point.value, 2),
      positive: round(point.positive, 2),
      negative: round(point.negative, 2),
      count: point.count,
      eventTypes: Array.from(point.eventTypes).sort(),
      players: Array.from(point.players).sort(),
      teams: Array.from(point.teams).sort()
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildRunningSeries(points) {
  let cumulative = 0;
  return safeArray(points).map((point) => {
    cumulative += point.value;
    return {
      ...point,
      cumulative: round(cumulative, 2)
    };
  });
}

function findExtremes(points) {
  if (!points.length) {
    return {
      highestDaily: null,
      lowestDaily: null,
      highestCumulative: null,
      lowestCumulative: null
    };
  }

  let highestDaily = points[0];
  let lowestDaily = points[0];
  let highestCumulative = points[0];
  let lowestCumulative = points[0];

  for (const point of points) {
    if (point.value > highestDaily.value) highestDaily = point;
    if (point.value < lowestDaily.value) lowestDaily = point;
    if (point.cumulative > highestCumulative.cumulative) highestCumulative = point;
    if (point.cumulative < lowestCumulative.cumulative) lowestCumulative = point;
  }

  return {
    highestDaily,
    lowestDaily,
    highestCumulative,
    lowestCumulative
  };
}

function computeTrend(points) {
  if (points.length < 2) {
    return {
      direction: "flat",
      slope: 0,
      recentDelta: 0
    };
  }

  const first = points[0].cumulative;
  const last = points[points.length - 1].cumulative;
  const slope = (last - first) / Math.max(1, points.length - 1);

  let recentDelta = 0;
  if (points.length >= 5) {
    const prev = points[points.length - 5].cumulative;
    recentDelta = last - prev;
  } else {
    recentDelta = last - first;
  }

  let direction = "flat";
  if (slope > 0.35) direction = "up";
  else if (slope < -0.35) direction = "down";

  return {
    direction,
    slope: round(slope, 4),
    recentDelta: round(recentDelta, 2)
  };
}

function detectInflectionPoints(points) {
  if (points.length < 3) return [];

  const result = [];

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dailyPeak = curr.value > prev.value && curr.value > next.value;
    const dailyValley = curr.value < prev.value && curr.value < next.value;
    const cumulativePeak = curr.cumulative > prev.cumulative && curr.cumulative > next.cumulative;
    const cumulativeValley = curr.cumulative < prev.cumulative && curr.cumulative < next.cumulative;

    if (dailyPeak || cumulativePeak) {
      result.push({
        date: curr.date,
        type: "peak",
        mode: dailyPeak ? "daily" : "cumulative",
        value: curr.value,
        cumulative: curr.cumulative,
        count: curr.count
      });
      continue;
    }

    if (dailyValley || cumulativeValley) {
      result.push({
        date: curr.date,
        type: "valley",
        mode: dailyValley ? "daily" : "cumulative",
        value: curr.value,
        cumulative: curr.cumulative,
        count: curr.count
      });
    }
  }

  return result;
}

function summarizeEvents(events) {
  const types = {};
  const severities = {};
  const teams = {};
  const players = new Set();
  let positiveEvents = 0;
  let negativeEvents = 0;
  let zeroEvents = 0;

  for (const event of safeArray(events)) {
    types[event.eventType] = (types[event.eventType] || 0) + 1;
    severities[event.severity] = (severities[event.severity] || 0) + 1;
    if (event.team) teams[event.team] = (teams[event.team] || 0) + 1;
    if (event.playerName) players.add(event.playerName);

    if (event.impact > 0) positiveEvents += 1;
    else if (event.impact < 0) negativeEvents += 1;
    else zeroEvents += 1;
  }

  return {
    byType: types,
    bySeverity: severities,
    byTeam: teams,
    uniquePlayers: players.size,
    positiveEvents,
    negativeEvents,
    zeroEvents
  };
}

function buildSummary(points, events) {
  const eventSummary = summarizeEvents(events);
  const extremes = findExtremes(points);
  const trend = computeTrend(points);
  const netImpact = points.length ? points[points.length - 1].cumulative : 0;
  const averageDailyImpact = points.length
    ? round(points.reduce((sum, p) => sum + p.value, 0) / points.length, 2)
    : 0;

  return {
    netImpact: round(netImpact, 2),
    averageDailyImpact,
    highestDaily: extremes.highestDaily,
    lowestDaily: extremes.lowestDaily,
    highestCumulative: extremes.highestCumulative,
    lowestCumulative: extremes.lowestCumulative,
    trend,
    eventSummary
  };
}

function buildEmptyTimeline(season, reason, filters = {}) {
  return {
    season,
    filters,
    points: [],
    events: [],
    inflectionPoints: [],
    summary: buildSummary([], []),
    eventCount: 0,
    pointCount: 0,
    synthetic: false,
    dataUnavailable: true,
    reason
  };
}

function buildWhereClause({ season, team, playerId, startDate, endDate, eventTypes }) {
  const clauses = [];
  const params = [];
  let idx = 1;

  clauses.push(`EXTRACT(YEAR FROM event_date) = $${idx}`);
  params.push(season);
  idx += 1;

  if (team) {
    clauses.push(`UPPER(COALESCE(team_abbr, team, club)) = $${idx}`);
    params.push(team.toUpperCase());
    idx += 1;
  }

  if (playerId) {
    clauses.push(`CAST(player_id AS TEXT) = $${idx}`);
    params.push(String(playerId));
    idx += 1;
  }

  if (startDate) {
    clauses.push(`event_date >= $${idx}`);
    params.push(startDate);
    idx += 1;
  }

  if (endDate) {
    clauses.push(`event_date <= $${idx}`);
    params.push(endDate);
    idx += 1;
  }

  if (safeArray(eventTypes).length) {
    const placeholders = eventTypes.map(() => `$${idx++}`);
    clauses.push(`LOWER(REPLACE(COALESCE(event_type, ''), ' ', '_')) IN (${placeholders.join(", ")})`);
    params.push(...eventTypes.map((v) => normalizeEventType(v)));
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

async function fetchTimelineRows(filters) {
  const season = normalizeSeason(filters.season);
  const team = asString(filters.team).toUpperCase() || null;
  const playerId = filters.playerId !== undefined && filters.playerId !== null ? String(filters.playerId) : null;
  const startDate = toIsoDay(filters.startDate);
  const endDate = toIsoDay(filters.endDate);
  const eventTypes = safeArray(filters.eventTypes).map(normalizeEventType).filter(Boolean);

  const normalizedFilters = {
    season,
    team,
    playerId,
    startDate,
    endDate,
    eventTypes
  };

  const { whereSql, params } = buildWhereClause(normalizedFilters);

  const sql = `
    SELECT
      id,
      event_date,
      event_type,
      impact_score,
      title,
      detail,
      description,
      message,
      player_id,
      player_name,
      first_name,
      last_name,
      team_abbr,
      team,
      club,
      source,
      provider,
      category,
      event_category,
      confidence,
      metadata
    FROM player_events
    ${whereSql}
    ORDER BY event_date ASC, id ASC
    LIMIT ${MAX_EVENTS}
  `;

  const result = await db.query(sql, params);
  return {
    rows: safeArray(result.rows),
    filters: normalizedFilters
  };
}

function normalizeEvents(rows) {
  return dedupeEvents(
    safeArray(rows)
      .map(normalizeRawRow)
      .filter(isRowUsable)
      .sort(compareEvents)
  );
}

function applyClientFilters(events, filters) {
  const minAbsImpact = asNumber(filters.minAbsImpact, 0);
  const severity = asString(filters.severity).toLowerCase() || null;
  const source = asString(filters.source).toLowerCase() || null;

  return safeArray(events).filter((event) => {
    if (Math.abs(event.impact) < minAbsImpact) return false;
    if (severity && event.severity !== severity) return false;
    if (source && event.source.toLowerCase() !== source) return false;
    return true;
  });
}

async function getTimelineData(input = {}) {
  const filters = safeObject(input);
  const season = normalizeSeason(filters.season);

  try {
    const fetched = await fetchTimelineRows(filters);
    let events = normalizeEvents(fetched.rows);
    events = applyClientFilters(events, filters);

    if (!events.length) {
      return buildEmptyTimeline(season, "NO_REAL_TIMELINE_DATA", fetched.filters);
    }

    const points = buildRunningSeries(aggregatePointsByDay(events));
    const inflectionPoints = detectInflectionPoints(points);
    const summary = buildSummary(points, events);

    return {
      season,
      filters: fetched.filters,
      points,
      events,
      inflectionPoints,
      summary,
      eventCount: events.length,
      pointCount: points.length,
      synthetic: false,
      dataUnavailable: false,
      reason: null
    };
  } catch (error) {
    return {
      ...buildEmptyTimeline(season, "TIMELINE_QUERY_FAILED", {
        season,
        team: asString(filters.team).toUpperCase() || null,
        playerId: filters.playerId !== undefined && filters.playerId !== null ? String(filters.playerId) : null,
        startDate: toIsoDay(filters.startDate),
        endDate: toIsoDay(filters.endDate),
        eventTypes: safeArray(filters.eventTypes).map(normalizeEventType).filter(Boolean)
      }),
      error: error.message
    };
  }
}

async function getInflectionPoints(input = {}) {
  const data = await getTimelineData(input);
  return {
    season: data.season,
    filters: data.filters,
    inflectionPoints: data.inflectionPoints,
    dataUnavailable: data.dataUnavailable,
    reason: data.reason,
    summary: {
      netImpact: data.summary.netImpact,
      trend: data.summary.trend
    }
  };
}

async function getTimelineEvents(input = {}) {
  const data = await getTimelineData(input);
  return {
    season: data.season,
    filters: data.filters,
    events: data.events,
    eventCount: data.eventCount,
    dataUnavailable: data.dataUnavailable,
    reason: data.reason
  };
}

module.exports = {
  getTimelineData,
  getInflectionPoints,
  getTimelineEvents,
  normalizeRawRow,
  normalizeEvents,
  aggregatePointsByDay,
  buildRunningSeries,
  detectInflectionPoints,
  buildSummary
};
