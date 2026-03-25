// backend/timeline.js
const db = require("./databases");

const DEFAULT_BASELINE = 5;
const DEFAULT_SEASON = new Date().getFullYear();

/* =========================
   UTIL FUNCTIONS
========================= */

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
    type.includes("absence")
  ) {
    return -impact;
  }

  if (
    type.includes("return") ||
    type.includes("activation") ||
    type.includes("signing") ||
    type.includes("win")
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

/* =========================
   SEEDED RANDOM (DETERMINISTIC)
========================= */

function seededUnit(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededRange(seed, min, max) {
  return min + seededUnit(seed) * (max - min);
}

function getSeasonProfile(season) {
  return {
    offenseBias: seededRange(season * 1.13, -0.9, 1.4),
    defenseBias: seededRange(season * 1.37, -1.1, 1.1),
    volatilityBias: seededRange(season * 1.73, 0.35, 1.25),
    lateSeasonBias: seededRange(season * 1.97, -0.4, 1.2),
    peakShift: Math.floor(seededRange(season * 2.11, 0, 4)),
    recoveryBias: seededRange(season * 2.41, 0.2, 0.95),
  };
}

function createSyntheticSeasonEvents(season) {
  const profile = getSeasonProfile(season);
  const events = [];

  for (let month = 0; month < 12; month++) {
    const shockSeed = season * 100 + month * 17;

    if (seededUnit(shockSeed + 3) > 0.82) {
      events.push({
        month,
        impact: -seededRange(shockSeed + 5, 0.5, 1.35) * profile.volatilityBias,
        label: "injury/slump",
      });
    }

    if (seededUnit(shockSeed + 11) > 0.86) {
      events.push({
        month,
        impact: seededRange(shockSeed + 13, 0.45, 1.15),
        label: "return/boost",
      });
    }
  }

  return events;
}

/* =========================
   SYNTHETIC TIMELINE (FIXED)
========================= */

function buildSyntheticTimeline(season = DEFAULT_SEASON) {
  const profile = getSeasonProfile(season);
  const syntheticEvents = createSyntheticSeasonEvents(season);

  const eventMap = new Map();
  for (const evt of syntheticEvents) {
    if (!eventMap.has(evt.month)) {
      eventMap.set(evt.month, []);
    }
    eventMap.get(evt.month).push(evt);
  }

  const points = [];
  let runningValue =
    DEFAULT_BASELINE +
    profile.offenseBias * 0.65 -
    profile.defenseBias * 0.35 +
    seededRange(season * 3.01, -0.45, 0.45);

  for (let month = 0; month < 12; month++) {
    const shiftedMonth = month + profile.peakShift;

    const wavePrimary =
      Math.sin(shiftedMonth / 1.45 + season * 0.061) * 1.15;

    const waveSecondary =
      Math.cos(shiftedMonth / 2.35 + season * 0.027) * 0.58;

    const earlySeasonAdjustment =
      month <= 2 ? seededRange(season * 10 + month, -0.3, 0.35) : 0;

    const midSeasonStability =
      month >= 3 && month <= 7
        ? 0.22 - profile.volatilityBias * 0.08
        : 0;

    const lateSeasonPush =
      month >= 8
        ? 0.35 + profile.lateSeasonBias * 0.55 + month * 0.035
        : 0;

    const monthNoise =
      seededRange(season * 1000 + month * 31, -0.22, 0.22) *
      profile.volatilityBias;

    const monthEvents = eventMap.get(month) || [];
    const eventImpact = monthEvents.reduce((sum, evt) => sum + evt.impact, 0);

    const recovery =
      month > 0
        ? (points[month - 1]?.value - DEFAULT_BASELINE) *
          (-0.08 * profile.recoveryBias)
        : 0;

    const delta =
      wavePrimary +
      waveSecondary +
      earlySeasonAdjustment +
      midSeasonStability +
      lateSeasonPush +
      monthNoise +
      eventImpact +
      recovery;

    runningValue += delta * 0.42;

    runningValue = Math.max(1.2, Math.min(11.8, runningValue));

    points.push(
      formatPoint(
        new Date(Date.UTC(season, month, 1)).toISOString(),
        runningValue,
        {
          source: "synthetic",
          syntheticEvents: monthEvents.map((evt) => ({
            label: evt.label,
            impact: Number(evt.impact.toFixed(2)),
          })),
        }
      )
    );
  }

  return {
    season,
    points,
    inflectionPoints: detectInflectionPoints(points),
    summary: buildSummary(points),
    eventCount: syntheticEvents.length,
    synthetic: true,
  };
}

/* =========================
   REAL DATA PIPELINE
========================= */

function aggregateRowsByDay(rows = []) {
  const grouped = new Map();

  for (const row of rows) {
    const isoDay = toIsoDay(row.event_date);
    if (!isoDay) continue;

    const signedImpact = classifyImpact(row.event_type, row.impact_score);

    if (!grouped.has(isoDay)) {
      grouped.set(isoDay, { date: isoDay, value: 0 });
    }

    grouped.get(isoDay).value += signedImpact;
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
}

function buildSummary(points = []) {
  let total = 0;
  let max = points[0];
  let min = points[0];

  for (const p of points) {
    total += p.value;
    if (p.value > max.value) max = p;
    if (p.value < min.value) min = p;
  }

  return {
    netImpact: Number(total.toFixed(2)),
    highestPoint: max,
    lowestPoint: min,
  };
}

function detectInflectionPoints(points = []) {
  if (points.length < 3) return [];

  const result = [];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].value;
    const curr = points[i].value;
    const next = points[i + 1].value;

    if (curr > prev && curr > next) {
      result.push({ ...points[i], type: "peak" });
    } else if (curr < prev && curr < next) {
      result.push({ ...points[i], type: "valley" });
    }
  }

  return result;
}

/* =========================
   MAIN API FUNCTIONS
========================= */

async function getTimelineData(season = DEFAULT_SEASON) {
  try {
    const result = await db.query(
      `SELECT event_date, impact_score, event_type 
       FROM player_events 
       WHERE EXTRACT(YEAR FROM event_date) = $1`,
      [season]
    );

    if (!result.rows.length) {
      return buildSyntheticTimeline(season);
    }

    const points = aggregateRowsByDay(result.rows);

    return {
      season,
      points,
      inflectionPoints: detectInflectionPoints(points),
      summary: buildSummary(points),
      eventCount: result.rows.length,
      synthetic: false,
    };
  } catch (err) {
    return buildSyntheticTimeline(season);
  }
}

async function getInflectionPoints(season) {
  const data = await getTimelineData(season);
  return {
    season,
    inflectionPoints: data.inflectionPoints,
  };
}

module.exports = {
  getTimelineData,
  getInflectionPoints,
  detectInflectionPoints,
};
