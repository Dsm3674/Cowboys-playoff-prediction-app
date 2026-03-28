"use strict";

const express = require("express");
const router = express.Router();

const timeline = require("../services/timeline");   // ✅ correct
const cache = require("../cache");

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

function normalizeFilters(input) {
  if (typeof input === "number") {
    return {
      season: normalizeSeason(input),
      team: DEFAULT_TEAM,
      playerId: null,
      startDate: null,
      endDate: null,
      eventTypes: [],
      severity: null,
      source: null,
      minAbsImpact: null
    };
  }

  const obj = safeObject(input);

  return {
    season: normalizeSeason(obj.season),
    team: asString(obj.team || DEFAULT_TEAM) || DEFAULT_TEAM,
    playerId: asString(obj.playerId) || null,
    startDate: asString(obj.startDate) || null,
    endDate: asString(obj.endDate) || null,
    eventTypes: Array.isArray(obj.eventTypes)
      ? obj.eventTypes.map((v) => asString(v).toLowerCase()).filter(Boolean)
      : [],
    severity: asString(obj.severity).toLowerCase() || null,
    source: asString(obj.source).toLowerCase() || null,
    minAbsImpact:
      obj.minAbsImpact === undefined || obj.minAbsImpact === null || obj.minAbsImpact === ""
        ? null
        : toNumber(obj.minAbsImpact, null)
  };
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

function inferSeverity(impact) {
  const abs = Math.abs(toNumber(impact, 0));
  if (abs >= 8) return "high";
  if (abs >= 4) return "medium";
  return "low";
}

function impactForEventType(type, rawImpact) {
  const normalized = normalizeEventType(type);
  if (Number.isFinite(Number(rawImpact))) return Number(rawImpact);

  const defaults = {
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
    defensive_leader: 3,
    special_teams_boost: 2
  };

  return defaults[normalized] ?? 0;
}

function buildWhereClause(filters) {
  const clauses = ["season = $1"];
  const params = [filters.season];
  let idx = 2;

  if (filters.team) {
    clauses.push(`COALESCE(team, '${DEFAULT_TEAM}') = $${idx}`);
    params.push(filters.team);
    idx += 1;
  }

  if (filters.playerId) {
    clauses.push(`CAST(COALESCE(player_id, '') AS TEXT) = $${idx}`);
    params.push(filters.playerId);
    idx += 1;
  }

  if (filters.startDate) {
    clauses.push(`event_date >= $${idx}`);
    params.push(filters.startDate);
    idx += 1;
  }

  if (filters.endDate) {
    clauses.push(`event_date <= $${idx}`);
    params.push(filters.endDate);
    idx += 1;
  }

  if (filters.eventTypes.length) {
    clauses.push(`LOWER(event_type) = ANY($${idx})`);
    params.push(filters.eventTypes);
    idx += 1;
  }

  if (filters.minAbsImpact !== null) {
    clauses.push(`ABS(COALESCE(impact_score, 0)) >= $${idx}`);
    params.push(filters.minAbsImpact);
    idx += 1;
  }

  return {
    whereSql: clauses.join(" AND "),
    params
  };
}

async function fetchEventsFromDb(filters) {
  const { whereSql, params } = buildWhereClause(filters);

  const sql = `
    SELECT
      id,
      CAST(player_id AS TEXT) AS player_id,
      player_name,
      event_type,
      event_date,
      description,
      impact_score,
      season
    FROM player_events
    WHERE ${whereSql}
    ORDER BY event_date ASC, id ASC
    LIMIT ${MAX_EVENTS}
  `;

  const result = await db.query(sql, params);
  return safeArray(result.rows);
}

function parseLeaders(summary) {
  const competition = summary?.header?.competitions?.[0];
  const competitors = safeArray(competition?.competitors);
  const cowboys = competitors.find((c) => asString(c?.team?.abbreviation).toUpperCase() === "DAL");

  if (!cowboys) return [];

  return safeArray(cowboys.leaders).flatMap((leaderGroup) => {
    const category = normalizeEventType(leaderGroup?.name || leaderGroup?.displayName || "leader");
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
  const cowboys = competitors.find((c) => asString(c?.team?.abbreviation).toUpperCase() === "DAL");
  const opponent = competitors.find((c) => asString(c?.team?.abbreviation).toUpperCase() !== "DAL");

  if (!cowboys || !opponent) return [];

  const date = toIsoTimestamp(competition?.date || summary?.header?.competitions?.[0]?.date);
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
    season,
    team: "DAL",
    source: "espn",
    severity: inferSeverity(diff >= 0 ? 4 : -4)
  });

  if (diff >= 14) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "dominant_win",
      event_date: date,
      description: `Dallas won by ${diff} points.`,
      impact_score: 6,
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
    });
  }

  if (diff > 0 && diff <= 3) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "close_win",
      event_date: date,
      description: `Dallas survived a one-score finish.`,
      impact_score: 5,
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
    });
  }

  if (diff < 0 && Math.abs(diff) <= 3) {
    events.push({
      player_id: null,
      player_name: "Dallas Cowboys",
      event_type: "close_loss",
      event_date: date,
      description: `Dallas lost a one-score game.`,
      impact_score: -5,
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
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
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
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
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
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
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
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
      season,
      team: "DAL",
      source: "espn",
      severity: "low"
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
      season,
      team: "DAL",
      source: "espn",
      severity: "medium"
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
    let impact = null;

    if (leader.category.includes("passing")) {
      eventType = "passing_leader";
      impact = 3;
    } else if (leader.category.includes("rushing")) {
      eventType = "rushing_leader";
      impact = 3;
    } else if (leader.category.includes("receiving")) {
      eventType = "receiving_leader";
      impact = 3;
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
      impact_score: impact,
      season,
      team: "DAL",
      source: "espn",
      severity: inferSeverity(impact)
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
      season,
      team: "DAL",
      source: "espn",
      severity: "low"
    });
  }

  return leaderEvents;
}

function dedupeEvents(events) {
  const map = new Map();

  safeArray(events).forEach((event) => {
    const playerName = asString(event.player_name) || "Dallas Cowboys";
    const eventType = normalizeEventType(event.event_type);
    const eventDate = toIsoTimestamp(event.event_date);
    if (!eventType || !eventDate) return;

    const key = `${playerName}|${eventType}|${eventDate}`;
    if (!map.has(key)) {
      map.set(key, {
        player_id: event.player_id || null,
        player_name: playerName,
        event_type: eventType,
        event_date: eventDate,
        description: asString(event.description) || null,
        impact_score: impactForEventType(eventType, event.impact_score),
        season: normalizeSeason(event.season),
        team: asString(event.team || DEFAULT_TEAM) || DEFAULT_TEAM,
        source: asString(event.source || "espn") || "espn",
        severity: asString(event.severity || inferSeverity(event.impact_score)) || inferSeverity(event.impact_score)
      });
    }
  });

  return [...map.values()].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
}

async function fetchGameSummary(eventId) {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`
  );

  if (!response.ok) return null;
  return response.json();
}

async function hydrateSeasonFromEspn(filters) {
  const season = filters.season;
  let games = [];

  try {
    games = await espn.fetchCowboysGamesSeasonToDate(season);
  } catch (err) {
    return { inserted: 0, errors: [err.message] };
  }

  const completedGames = safeArray(games).filter((g) => g && g.completed && g.id);
  if (!completedGames.length) {
    return { inserted: 0, errors: [] };
  }

  const summaries = await Promise.all(
    completedGames.map(async (game) => {
      try {
        return await fetchGameSummary(game.id);
      } catch (err) {
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

  const events = dedupeEvents(rawEvents);

  let inserted = 0;

  for (const event of events) {
    await db.query(
      `
        INSERT INTO player_events
          (player_id, player_name, event_type, event_date, description, impact_score, season, team)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (player_name, event_date, event_type)
        DO UPDATE SET
          description = EXCLUDED.description,
          impact_score = EXCLUDED.impact_score,
          season = EXCLUDED.season
      `,
      [
        event.player_id,
        event.player_name,
        event.event_type,
        event.event_date,
        event.description,
        event.impact_score,
        event.season,
        event.team
      ]
    );
    inserted += 1;
  }

  return { inserted, errors: [] };
}

function toTimelineEvent(row) {
  const eventType = normalizeEventType(row.event_type);
  const impact = impactForEventType(eventType, row.impact_score);

  return {
    id: row.id || null,
    playerId: row.player_id || null,
    playerName: row.player_name || null,
    eventType,
    date: toIsoTimestamp(row.event_date),
    day: toIsoDay(row.event_date),
    description: asString(row.description) || null,
    impact,
    severity: inferSeverity(impact),
    source: "database"
  };
}

function buildTimelinePoints(events) {
  const sorted = safeArray(events).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;

  return sorted.map((event) => {
    running += toNumber(event.impact, 0);
    return {
      date: event.date,
      value: Number(running.toFixed(2)),
      eventType: event.eventType,
      impact: event.impact,
      playerName: event.playerName || null
    };
  });
}

function buildInflectionPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) {
    return [
      {
        date: points[0].date,
        type: "start",
        value: points[0].value,
        description: "Only timeline point available."
      }
    ];
  }

  const inflections = [];

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (!prev) {
      inflections.push({
        date: curr.date,
        type: "start",
        value: curr.value,
        description: "Timeline starting point."
      });
      continue;
    }

    const delta = curr.value - prev.value;

    if (Math.abs(delta) >= 8) {
      inflections.push({
        date: curr.date,
        type: delta > 0 ? "surge" : "drop",
        value: curr.value,
        description: delta > 0 ? "Large positive shift." : "Large negative shift."
      });
    }

    if (prev && next) {
      if (curr.value > prev.value && curr.value > next.value) {
        inflections.push({
          date: curr.date,
          type: "peak",
          value: curr.value,
          description: "Local peak."
        });
      }

      if (curr.value < prev.value && curr.value < next.value) {
        inflections.push({
          date: curr.date,
          type: "valley",
          value: curr.value,
          description: "Local valley."
        });
      }
    }
  }

  const deduped = [];
  const seen = new Set();

  inflections.forEach((point) => {
    const key = `${point.date}|${point.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(point);
    }
  });

  return deduped;
}

function summarizeTimeline(events, points) {
  const netImpact = points.length ? points[points.length - 1].value : 0;
  const positiveEvents = events.filter((e) => e.impact > 0).length;
  const negativeEvents = events.filter((e) => e.impact < 0).length;
  const neutralEvents = events.filter((e) => e.impact === 0).length;

  let trend = "flat";
  if (netImpact > 0) trend = "up";
  if (netImpact < 0) trend = "down";

  return {
    netImpact,
    trend,
    positiveEvents,
    negativeEvents,
    neutralEvents
  };
}

async function loadTimelineEvents(filters) {
  let rows = await fetchEventsFromDb(filters);

  if (!rows.length) {
    await hydrateSeasonFromEspn(filters);
    rows = await fetchEventsFromDb(filters);
  }

  return rows.map(toTimelineEvent);
}

async function getTimelineData(input) {
  const filters = normalizeFilters(input);

  try {
    const events = await loadTimelineEvents(filters);
    const points = buildTimelinePoints(events);
    const inflectionPoints = buildInflectionPoints(points);
    const summary = summarizeTimeline(events, points);

    if (!events.length) {
      return {
        season: filters.season,
        filters,
        points: [],
        events: [],
        inflectionPoints: [],
        summary,
        eventCount: 0,
        pointCount: 0,
        synthetic: false,
        dataUnavailable: true,
        reason: DEFAULT_REASON_MESSAGES.NO_REAL_TIMELINE_DATA,
        error: null
      };
    }

    return {
      season: filters.season,
      filters,
      points,
      events,
      inflectionPoints,
      summary,
      eventCount: events.length,
      pointCount: points.length,
      synthetic: false,
      dataUnavailable: false,
      reason: null,
      error: null
    };
  } catch (err) {
    return {
      season: filters.season,
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
      reason: DEFAULT_REASON_MESSAGES.TIMELINE_QUERY_FAILED,
      error: err.message
    };
  }
}

async function getTimelineEvents(input) {
  const data = await getTimelineData(input);
  return {
    season: data.season,
    filters: data.filters,
    events: data.events,
    eventCount: data.eventCount,
    dataUnavailable: data.dataUnavailable,
    reason: data.reason,
    error: data.error
  };
}

async function getInflectionPoints(input) {
  const data = await getTimelineData(input);
  return {
    season: data.season,
    filters: data.filters,
    inflectionPoints: data.inflectionPoints,
    summary: data.summary,
    dataUnavailable: data.dataUnavailable,
    reason: data.reason,
    error: data.error
  };
}

module.exports = {
  getTimelineData,
  getTimelineEvents,
  getInflectionPoints,
  hydrateSeasonFromEspn
};
