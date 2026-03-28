"use strict";

const db = require("./databases");
const espn = require("./services/espn");
const fetch = global.fetch;

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

function toIsoTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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
    release: -3,
    game_win: 4,
    game_loss: -4,
    dominant_win: 6,
    close_win: 5,
    close_loss: -5,
    blowout_loss: -6,
    offensive_breakout: 5,
    offensive_struggle: -4,
    defensive_clamp: 4,
    defensive_collapse: -5,
    passing_leader: 3,
    rushing_leader: 3,
    receiving_leader: 3,
    defensive_leader: 3
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

function normalizeFilters(input) {
  const obj = safeObject(input);

  return {
    season: normalizeSeason(obj.season),
    team: asString(obj.team).toUpperCase() || DEFAULT_TEAM,
    playerId:
      obj.playerId !== undefined && obj.playerId !== null
        ? String(obj.playerId)
        : null,
    startDate: toIsoDay(obj.startDate),
    endDate: toIsoDay(obj.endDate),
    eventTypes: safeArray(obj.eventTypes).map(normalizeEventType).filter(Boolean),
    severity: asString(obj.severity).toLowerCase() || null,
    source: asString(obj.source).toLowerCase() || null,
    minAbsImpact:
      obj.minAbsImpact === undefined || obj.minAbsImpact === null || obj.minAbsImpact === ""
        ? 0
        : Math.max(0, Number(obj.minAbsImpact) || 0)
  };
}

async function fetchTimelineRows(filters) {
  const normalizedFilters = normalizeFilters(filters);

  const clauses = [];
  const params = [];
  let idx = 1;

  clauses.push(`season = $${idx}`);
  params.push(normalizedFilters.season);
  idx += 1;

  if (normalizedFilters.playerId) {
    clauses.push(`CAST(player_id AS TEXT) = $${idx}`);
    params.push(normalizedFilters.playerId);
    idx += 1;
  }

  if (normalizedFilters.startDate) {
    clauses.push(`event_date >= $${idx}`);
    params.push(normalizedFilters.startDate);
    idx += 1;
  }

  if (normalizedFilters.endDate) {
    clauses.push(`event_date <= $${idx}`);
    params.push(normalizedFilters.endDate);
    idx += 1;
  }

  if (normalizedFilters.eventTypes.length) {
    const placeholders = normalizedFilters.eventTypes.map(() => `$${idx++}`);
    clauses.push(
      `LOWER(REPLACE(COALESCE(event_type, ''), ' ', '_')) IN (${placeholders.join(", ")})`
    );
    params.push(...normalizedFilters.eventTypes);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      id,
      event_date,
      event_type,
      impact_score,
      description,
      player_id,
      player_name
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
  const eventType = normalizeEventType(raw.event_type);
  const playerName = asString(raw.player_name) || "Unknown player";
  const impact = impactForEventType(eventType, raw.impact_score);
  const date = toIsoTimestamp(raw.event_date);

  return {
    id: raw.id ?? `${playerName}-${date}-${eventType}`,
    date,
    day: date ? date.slice(0, 10) : null,
    eventType,
    title: eventType.replace(/_/g, " "),
    description: asString(raw.description) || eventType.replace(/_/g, " "),
    impact,
    severity: classifySeverity(impact),
    source: "database",
    playerId:
      raw.player_id !== undefined && raw.player_id !== null
        ? String(raw.player_id)
        : null,
    playerName,
    team: DEFAULT_TEAM,
    confidence: null,
    metadata: {}
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

  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
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
  return safeArray(events).filter((event) => {
    if (Math.abs(event.impact) < filters.minAbsImpact) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.source && event.source.toLowerCase() !== filters.source) return false;
    return true;
  });
}

function parseLeaders(summary) {
  const competition = summary?.header?.competitions?.[0];
  const competitors = safeArray(competition?.competitors);
  const cowboys = competitors.find(
    (c) => asString(c?.team?.abbreviation).toUpperCase() === "DAL"
  );

  if (!cowboys) return [];

  return safeArray(cowboys.leaders).flatMap((leaderGroup) => {
    const category = normalizeEventType(
      leaderGroup?.name || leaderGroup?.displayName || "leader"
    );

    return safeArray(leaderGroup?.leaders).map((leader) => ({
      category,
      athlete: asString(leader?.athlete?.displayName),
      value: asString(leader?.displayValue || leader?.value)
    }));
  });
}

function detectDefensiveLeader(summary) {
  const drives = safeArray(summary?.drives?.previous);
  const counts = new Map();

  drives.forEach((drive) => {
    safeArray(drive.plays).forEach((play) => {
      const text = asString(play?.text).toLowerCase();
      if (!text) return;

      const names = [
        "micah parsons",
        "demarcus lawrence",
        "osa odighizuwa",
        "trevon diggs",
        "daron bland",
        "jourdan lewis",
        "malik hooker",
        "donovan wilson"
      ];

      names.forEach((name) => {
        if (text.includes(name)) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      });
    });
  });

  let bestName = null;
  let bestCount = 0;

  counts.forEach((count, name) => {
    if (count > bestCount) {
      bestCount = count;
      bestName = name;
    }
  });

  if (!bestName || bestCount < 2) return null;

  return {
    athlete: bestName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    value: `${bestCount} impact mentions`
  };
}

function buildGameLevelEvents(summary, season) {
  const competition = summary?.header?.competitions?.[0];
  const competitors = safeArray(competition?.competitors);
  const cowboys = competitors.find(
    (c) => asString(c?.team?.abbreviation).toUpperCase() === "DAL"
  );
  const opponent = competitors.find(
    (c) => asString(c?.team?.abbreviation).toUpperCase() !== "DAL"
  );

  if (!cowboys || !opponent) return [];

  const date = toIsoTimestamp(competition?.date);
  if (!date) return [];

  const dalScore = toNumber(cowboys?.score, 0);
  const oppScore = toNumber(opponent?.score, 0);
  const diff = dalScore - oppScore;

  const events = [];

  events.push({
    player_id: null,
    player_name: "Dallas Cowboys",
    event_type: diff >= 0 ? "game_win" : "game_loss",
    event_date: date,
    description: `Dallas ${dalScore}-${oppScore} vs ${asString(opponent?.team?.displayName || opponent?.team?.name || opponent?.team?.abbreviation)}`,
    impact_score: diff >= 0 ? 4 : -4,
    season
  });

  if (diff >= 14) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "dominant_win",
      event_date: date,
      description: `Dallas won by ${diff} points.`,
      impact_score: 6,
      season
    });
  }

  if (diff > 0 && diff <= 3) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "close_win",
      event_date: date,
      description: "Dallas survived a one-score finish.",
      impact_score: 5,
      season
    });
  }

  if (diff < 0 && Math.abs(diff) <= 3) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "close_loss",
      event_date: date,
      description: "Dallas lost a one-score game.",
      impact_score: -5,
      season
    });
  }

  if (diff <= -14) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "blowout_loss",
      event_date: date,
      description: `Dallas lost by ${Math.abs(diff)} points.`,
      impact_score: -6,
      season
    });
  }

  if (dalScore >= 30) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "offensive_breakout",
      event_date: date,
      description: `Dallas scored ${dalScore} points.`,
      impact_score: 5,
      season
    });
  }

  if (dalScore <= 14) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "offensive_struggle",
      event_date: date,
      description: `Dallas was held to ${dalScore} points.`,
      impact_score: -4,
      season
    });
  }

  if (oppScore <= 17) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys Defense",
      event_type: "defensive_clamp",
      event_date: date,
      description: `Dallas held the opponent to ${oppScore} points.`,
      impact_score: 4,
      season
    });
  }

  if (oppScore >= 30) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys Defense",
      event_type: "defensive_collapse",
      event_date: date,
      description: `Dallas allowed ${oppScore} points.`,
      impact_score: -5,
      season
    });
  }

  return events;
}

function buildLeaderEvents(summary, season) {
  const competition = summary?.header?.competitions?.[0];
  const date = toIsoTimestamp(competition?.date);
  if (!date) return [];

  const leaderEvents = [];
  const seen = new Set();

  parseLeaders(summary).forEach((leader) => {
    if (!leader.athlete) return;

    let eventType = null;

    if (leader.category.includes("passing")) {
      eventType = "passing_leader";
    } else if (leader.category.includes("rushing")) {
      eventType = "rushing_leader";
    } else if (leader.category.includes("receiving")) {
      eventType = "receiving_leader";
    }

    if (!eventType) return;

    const key = `${leader.athlete}:${eventType}:${date}`;
    if (seen.has(key)) return;
    seen.add(key);

    leaderEvents.push({
      player_id: null,
      player_name: leader.athlete,
      event_type: eventType,
      event_date: date,
      description: `${leader.athlete} led Dallas in ${leader.category.replace(/_/g, " ")} (${leader.value}).`,
      impact_score: 3,
      season
    });
  });

  const defensiveLeader = detectDefensiveLeader(summary);
  if (defensiveLeader?.athlete) {
    leaderEvents.push({
      player_id: null,
      player_name: defensiveLeader.athlete,
      event_type: "defensive_leader",
      event_date: date,
      description: `${defensiveLeader.athlete} stood out defensively (${defensiveLeader.value}).`,
      impact_score: 3,
      season
    });
  }

  return leaderEvents;
}

function dedupeHydratedEvents(events) {
  const map = new Map();

  safeArray(events).forEach((event) => {
    const playerName = asString(event.player_name) || "Dallas Cowboys";
    const eventType = normalizeEventType(event.event_type);
    const eventDate = toIsoTimestamp(event.event_date);
    if (!playerName || !eventType || !eventDate) return;

    const key = `${playerName}|${eventType}|${eventDate}`;
    if (!map.has(key)) {
      map.set(key, {
        player_id: event.player_id || null,
        player_name: playerName,
        event_type: eventType,
        event_date: eventDate,
        description: asString(event.description) || null,
        impact_score: impactForEventType(eventType, event.impact_score),
        season: normalizeSeason(event.season)
      });
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
}

async function fetchGameSummary(eventId) {
  if (typeof fetch !== "function") return null;

  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`
  );

  if (!response.ok) return null;
  return response.json();
}

async function hydrateSeasonFromEspn(season) {
  if (typeof espn?.fetchCowboysGamesSeasonToDate !== "function") {
    return { inserted: 0, errors: ["ESPN service unavailable"] };
  }

  let games = [];

  try {
    games = await espn.fetchCowboysGamesSeasonToDate(season);
  } catch (error) {
    return { inserted: 0, errors: [error.message] };
  }

  const completedGames = safeArray(games).filter((game) => game && game.completed && game.id);
  if (!completedGames.length) {
    return { inserted: 0, errors: [] };
  }

  const summaries = await Promise.all(
    completedGames.map(async (game) => {
      try {
        return await fetchGameSummary(game.id);
      } catch (error) {
        return null;
      }
    })
  );

  const rawEvents = [];
  summaries.forEach((summary) => {
    if (!summary) return;
    rawEvents.push(...buildGameLevelEvents(summary, season));
    rawEvents.push(...buildLeaderEvents(summary, season));
  });

  const events = dedupeHydratedEvents(rawEvents);

  let inserted = 0;

  for (const event of events) {
    await db.query(
      `
        INSERT INTO player_events
          (player_id, player_name, event_type, event_date, description, impact_score, season)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (player_name, event_date, event_type)
        DO UPDATE SET
          description = EXCLUDED.description,
          impact_score = EXCLUDED.impact_score,
          season = EXCLUDED.season,
          updated_at = NOW()
      `,
      [
        event.player_id,
        event.player_name,
        event.event_type,
        event.event_date,
        event.description,
        event.impact_score,
        event.season
      ]
    );
    inserted += 1;
  }

  return { inserted, errors: [] };
}

async function getTimelineData(input = {}) {
  const filters = normalizeFilters(input);

  try {
    let fetched = await fetchTimelineRows(filters);
    let events = applyClientFilters(normalizeEvents(fetched.rows), filters);

    if (!events.length) {
      await hydrateSeasonFromEspn(filters.season);
      fetched = await fetchTimelineRows(filters);
      events = applyClientFilters(normalizeEvents(fetched.rows), filters);
    }

    if (!events.length) {
      return buildEmptyTimeline(filters.season, "NO_REAL_TIMELINE_DATA", fetched.filters);
    }

    const points = buildRunningSeries(aggregatePointsByDay(events));
    const inflectionPoints = detectInflectionPoints(points);
    const summary = buildSummary(points, events);

    return {
      season: filters.season,
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
      ...buildEmptyTimeline(filters.season, "TIMELINE_QUERY_FAILED", filters),
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
  buildSummary,
  hydrateSeasonFromEspn
};
