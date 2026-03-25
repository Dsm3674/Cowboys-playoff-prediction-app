// backend/timeline.js
const db = require("./databases");

const DEFAULT_BASELINE = 5;
const DEFAULT_SEASON = new Date().getFullYear();

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toIsoDay(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;

  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  ).toISOString();
}

function normalizeEventType(eventType = "") {
  return String(eventType || "").trim().toLowerCase();
}

function classifyImpact(eventType, impactScore) {
  const type = normalizeEventType(eventType);
  const impact = Math.abs(toNumber(impactScore, 0));

  if (
    type.includes("injury") ||
    type.includes("suspension") ||
    type.includes("loss") ||
    type.includes("absence") ||
    type.includes("setback")
  ) {
    return -impact;
  }

  if (
    type.includes("return") ||
    type.includes("activation") ||
    type.includes("signing") ||
    type.includes("win") ||
    type.includes("boost")
  ) {
    return impact;
  }

  return toNumber(impactScore, 0);
}

function formatPoint(date, value, extra = {}) {
  return {
    date,
    value: Number(toNumber(value, 0).toFixed(2)),
    ...extra,
  };
}

function buildEmptyResult(season = DEFAULT_SEASON) {
  return {
    season,
    points: [],
    inflectionPoints: [],
    eventCount: 0,
    summary: {
      totalPositiveImpact: 0,
      totalNegativeImpact: 0,
      netImpact: 0,
      highestPoint: null,
      lowestPoint: null,
      pointCount: 0,
    },
  };
}

function buildSyntheticTimeline(season = DEFAULT_SEASON) {
  const monthLabels = Array.from({ length: 12 }, (_, idx) => idx);
  const points = monthLabels.map((month) => {
    const wave = Math.sin(month / 1.7) * 1.45;
    const slope = month * 0.12;
    const seasonalBump = month >= 8 && month <= 11 ? 0.65 : 0;
    const value = DEFAULT_BASELINE + wave + slope + seasonalBump;

    return formatPoint(
      new Date(Date.UTC(season, month, 1)).toISOString(),
      value,
      { source: "synthetic" }
    );
  });

  const inflectionPoints = detectInflectionPoints(points);
  const summary = buildSummary(points);

  return {
    season,
    points,
    inflectionPoints,
    eventCount: 0,
    summary,
    synthetic: true,
  };
}

function aggregateRowsByDay(rows = []) {
  const grouped = new Map();

  for (const row of rows) {
    const isoDay = toIsoDay(row.event_date);
    if (!isoDay) continue;

    const signedImpact = classifyImpact(row.event_type, row.impact_score);

    if (!grouped.has(isoDay)) {
      grouped.set(isoDay, {
        date: isoDay,
        value: 0,
        rawEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        neutralEvents: 0,
      });
    }

    const bucket = grouped.get(isoDay);
    bucket.value += signedImpact;
    bucket.rawEvents += 1;

    if (signedImpact > 0) {
      bucket.positiveEvents += 1;
    } else if (signedImpact < 0) {
      bucket.negativeEvents += 1;
    } else {
      bucket.neutralEvents += 1;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((point) =>
      formatPoint(point.date, point.value, {
        rawEvents: point.rawEvents,
        positiveEvents: point.positiveEvents,
        negativeEvents: point.negativeEvents,
        neutralEvents: point.neutralEvents,
      })
    );
}

function buildSummary(points = []) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      totalPositiveImpact: 0,
      totalNegativeImpact: 0,
      netImpact: 0,
      highestPoint: null,
      lowestPoint: null,
      pointCount: 0,
    };
  }

  let totalPositiveImpact = 0;
  let totalNegativeImpact = 0;
  let highestPoint = points[0];
  let lowestPoint = points[0];

  for (const point of points) {
    const value = toNumber(point.value, 0);

    if (value > 0) totalPositiveImpact += value;
    if (value < 0) totalNegativeImpact += value;

    if (value > toNumber(highestPoint.value, 0)) {
      highestPoint = point;
    }

    if (value < toNumber(lowestPoint.value, 0)) {
      lowestPoint = point;
    }
  }

  return {
    totalPositiveImpact: Number(totalPositiveImpact.toFixed(2)),
    totalNegativeImpact: Number(totalNegativeImpact.toFixed(2)),
    netImpact: Number((totalPositiveImpact + totalNegativeImpact).toFixed(2)),
    highestPoint,
    lowestPoint,
    pointCount: points.length,
  };
}

function createInflectionDescription(type, point, prev, next) {
  const value = toNumber(point.value, 0);
  const prevValue = toNumber(prev.value, 0);
  const nextValue = toNumber(next.value, 0);

  if (type === "peak") {
    return `Performance peak: rose from ${prevValue.toFixed(2)} to ${value.toFixed(
      2
    )} before dropping to ${nextValue.toFixed(2)}.`;
  }

  return `Performance valley: dropped from ${prevValue.toFixed(
    2
  )} to ${value.toFixed(2)} before recovering to ${nextValue.toFixed(2)}.`;
}

function detectInflectionPoints(points = []) {
  if (!Array.isArray(points) || points.length < 3) return [];

  const inflections = [];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const prevValue = toNumber(prev.value, 0);
    const currValue = toNumber(curr.value, 0);
    const nextValue = toNumber(next.value, 0);

    const isPeak = currValue > prevValue && currValue > nextValue;
    const isValley = currValue < prevValue && currValue < nextValue;

    if (!isPeak && !isValley) continue;

    const type = isPeak ? "peak" : "valley";
    inflections.push({
      date: curr.date,
      type,
      value: Number(currValue.toFixed(2)),
      deltaFromPrevious: Number((currValue - prevValue).toFixed(2)),
      deltaToNext: Number((nextValue - currValue).toFixed(2)),
      description: createInflectionDescription(type, curr, prev, next),
    });
  }

  return inflections;
}

function normalizeSeason(seasonInput) {
  const season = Number(seasonInput);
  return Number.isInteger(season) && season > 1900 ? season : DEFAULT_SEASON;
}

async function fetchTimelineRows(season) {
  const query = `
    SELECT event_date, impact_score, event_type
    FROM player_events
    WHERE EXTRACT(YEAR FROM event_date) = $1
    ORDER BY event_date ASC
  `;

  const result = await db.query(query, [season]);
  return Array.isArray(result.rows) ? result.rows : [];
}

async function getTimelineData(seasonInput = DEFAULT_SEASON) {
  const season = normalizeSeason(seasonInput);

  try {
    const rows = await fetchTimelineRows(season);

    if (rows.length === 0) {
      return buildSyntheticTimeline(season);
    }

    const points = aggregateRowsByDay(rows);
    const inflectionPoints = detectInflectionPoints(points);
    const summary = buildSummary(points);

    return {
      season,
      points,
      inflectionPoints,
      eventCount: rows.length,
      summary,
      synthetic: false,
    };
  } catch (error) {
    return {
      ...buildEmptyResult(season),
      error: error.message,
    };
  }
}

async function getInflectionPoints(seasonInput = DEFAULT_SEASON) {
  const season = normalizeSeason(seasonInput);

  try {
    const timelineData = await getTimelineData(season);

    if (timelineData.error) {
      return {
        season,
        inflectionPoints: [],
        eventCount: 0,
        summary: buildEmptyResult(season).summary,
        error: timelineData.error,
      };
    }

    return {
      season,
      inflectionPoints: timelineData.inflectionPoints || [],
      eventCount: timelineData.eventCount || 0,
      summary: timelineData.summary || buildEmptyResult(season).summary,
      synthetic: Boolean(timelineData.synthetic),
    };
  } catch (error) {
    return {
      season,
      inflectionPoints: [],
      eventCount: 0,
      summary: buildEmptyResult(season).summary,
      error: error.message,
    };
  }
}

module.exports = {
  classifyImpact,
  aggregateRowsByDay,
  buildSummary,
  detectInflectionPoints,
  getTimelineData,
  getInflectionPoints,
};
