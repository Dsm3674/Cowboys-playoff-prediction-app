const db = require("./databases");

const MAX_EVENTS = 500;
const DEFAULT_TEAM = "DAL";
const DEFAULT_REASON_MESSAGES = {
  NO_REAL_TIMELINE_DATA: "No real timeline data found for the selected filters.",
  TIMELINE_QUERY_FAILED: "Timeline query failed."
};

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSeason(value) {
  const year = Number(value);
  if (Number.isInteger(year) && year >= 1900 && year <= 3000) return year;
  return new Date().getFullYear();
}

function toIsoDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeEventType(value) {
  return asString(value).toLowerCase().replace(/\s+/g, "_");
}

function impactForEventType(type, rawImpact) {
  const normalized = normalizeEventType(type);
  if (Number.isFinite(Number(rawImpact))) return Number(rawImpact);

  const defaults = {
    injury: -8,
    suspension: -7,
    absence: -5,
    setback: -4,
    return: 7,
    activation: 6,
    breakout: 8,
    performance_peak: 9,
    achievement: 5,
    trade: 3,
    signing: 4,
    release: -3
  };

  return defaults[normalized] ?? 0;
}

function classifySeverity(impact) {
  const abs = Math.abs(Number(impact) || 0);
  if (abs >= 8) return "high";
  if (abs >= 4) return "medium";
  return "low";
}

function inferTrend(netImpact) {
  if (netImpact > 5) return "up";
  if (netImpact < -5) return "down";
  return "flat";
}

function formatReason(code) {
  return DEFAULT_REASON_MESSAGES[code] || code;
}

function buildEmptyTimeline(season, reasonCode, filters = {}) {
  return {
    season,
    filters,
    points: [],
    events: [],
    inflectionPoints: [],
    summary: {
      netImpact: 0,
      trend: "flat",
      positiveEvents: 0,
      negativeEvents: 0,
      neutralEvents: 0
    },
    eventCount: 0,
    pointCount: 0,
    synthetic: false,
    dataUnavailable: true,
    reason: formatReason(reasonCode)
  };
}

async function fetchTimelineRows(filters) {
  const season = normalizeSeason(filters.season);
  const team = asString(filters.team).toUpperCase() || null;
  const playerId =
    filters.playerId !== undefined && filters.playerId !== null
      ? String(filters.playerId)
      : null;
  const startDate = toIsoDay(filters.startDate);
  const endDate = toIsoDay(filters.endDate);
  const eventTypes = safeArray(filters.eventTypes)
    .map(normalizeEventType)
    .filter(Boolean);

  const normalizedFilters = {
    season,
    team,
    playerId,
    startDate,
    endDate,
    eventTypes
  };

  const clauses = [];
  const params = [];
  let idx = 1;

  clauses.push(`season = $${idx}`);
  params.push(season);
  idx += 1;

  if (playerId) {
    clauses.push(`CAST(player_id AS TEXT) = $${idx}`);
    params.push(playerId);
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

  if (eventTypes.length) {
    const placeholders = eventTypes.map(() => `$${idx++}`);
    clauses.push(
      `LOWER(REPLACE(COALESCE(event_type, ''), ' ', '_')) IN (${placeholders.join(", ")})`
    );
    params.push(...eventTypes);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      id,
      event_date,
      event_type,
      impact_score,
      NULL::text AS title,
      NULL::text AS detail,
      description,
      NULL::text AS message,
      player_id,
      player_name,
      NULL::text AS first_name,
      NULL::text AS last_name,
      NULL::text AS team_abbr,
      NULL::text AS team,
      NULL::text AS club,
      NULL::text AS source,
      NULL::text AS provider,
      NULL::text AS category,
      NULL::text AS event_category,
      NULL::numeric AS confidence,
      NULL::jsonb AS metadata
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

function normalizeRawRow(raw) {
  const eventType = normalizeEventType(raw.event_type || raw.category || raw.event_category);
  const playerName =
    asString(raw.player_name) ||
    [asString(raw.first_name), asString(raw.last_name)].filter(Boolean).join(" ") ||
    "Unknown player";

  const impact = impactForEventType(eventType, raw.impact_score);
  const dateValue = raw.event_date || raw.date || raw.created_at;
  const date = dateValue ? new Date(dateValue).toISOString() : null;

  const title = asString(raw.title) || eventType.replace(/_/g, " ");
  const description =
    asString(raw.description) ||
    asString(raw.detail) ||
    asString(raw.message) ||
    title;

  const source =
    asString(raw.source) ||
    asString(raw.provider) ||
    "database";

  return {
    id: raw.id ?? `${playerName}-${date}-${eventType}`,
    date,
    day: date ? date.slice(0, 10) : null,
    eventType,
    title,
    description,
    impact,
    severity: classifySeverity(impact),
    source: source.toLowerCase(),
    playerId:
      raw.player_id !== undefined && raw.player_id !== null
        ? String(raw.player_id)
        : null,
    playerName,
    team:
      asString(raw.team_abbr) ||
      asString(raw.team) ||
      asString(raw.club) ||
      DEFAULT_TEAM,
    confidence:
      raw.confidence !== undefined && raw.confidence !== null
        ? toNumber(raw.confidence, null)
        : null,
    metadata: safeObject(raw.metadata)
  };
}

function normalizeEvents(rows) {
  return safeArray(rows)
    .map(normalizeRawRow)
    .filter((event) => event.date && event.day && event.eventType)
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return String(a.id).localeCompare(String(b.id));
    });
}

function aggregatePointsByDay(events) {
  const byDay = new Map();

  safeArray(events).forEach((event) => {
    const current = byDay.get(event.day) || {
      date: event.day,
      delta: 0,
      eventCount: 0,
      events: []
    };

    current.delta += Number(event.impact || 0);
    current.eventCount += 1;
    current.events.push(event);
    byDay.set(event.day, current);
  });

  return Array.from(byDay.values()).sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

function buildRunningSeries(dayBuckets) {
  let running = 0;

  return safeArray(dayBuckets).map((bucket) => {
    running += Number(bucket.delta || 0);

    return {
      date: bucket.date,
      value: Number(running.toFixed(2)),
      delta: Number(Number(bucket.delta || 0).toFixed(2)),
      eventCount: bucket.eventCount
    };
  });
}

function detectInflectionPoints(points) {
  const list = safeArray(points);
  if (list.length < 3) return [];

  const inflections = [];

  for (let i = 1; i < list.length - 1; i += 1) {
    const prev = Number(list[i - 1].value || 0);
    const curr = Number(list[i].value || 0);
    const next = Number(list[i + 1].value || 0);

    if (curr > prev && curr > next) {
      inflections.push({
        date: list[i].date,
        type: "peak",
        value: curr
      });
    } else if (curr < prev && curr < next) {
      inflections.push({
        date: list[i].date,
        type: "valley",
        value: curr
      });
    }
  }

  return inflections;
}

function buildSummary(points, events) {
  const netImpact = safeArray(points).length
    ? Number(points[points.length - 1].value || 0)
    : 0;

  const positiveEvents = safeArray(events).filter((event) => event.impact > 0).length;
  const negativeEvents = safeArray(events).filter((event) => event.impact < 0).length;
  const neutralEvents = safeArray(events).filter((event) => event.impact === 0).length;

  return {
    netImpact,
    trend: inferTrend(netImpact),
    positiveEvents,
    negativeEvents,
    neutralEvents
  };
}

function applyClientFilters(events, filters) {
  const minAbsImpact = Number(filters.minAbsImpact || 0);
  const severity = asString(filters.severity).toLowerCase();
  const source = asString(filters.source).toLowerCase();

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
        playerId:
          filters.playerId !== undefined && filters.playerId !== null
            ? String(filters.playerId)
            : null,
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
