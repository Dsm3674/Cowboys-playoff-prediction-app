"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../databases");
const cache = require("../cache");
const { getTimelineEvents } = require("../timeline");

const REAL_COWBOYS_PLAYERS = [
  {
    player_id: "dak_prescott",
    player_name: "Dak Prescott",
    first_name: "Dak",
    last_name: "Prescott",
    position: "QB",
    jersey_number: 4,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["dak", "prescott", "dak prescott", "qb"]
  },
  {
    player_id: "ceedee_lamb",
    player_name: "CeeDee Lamb",
    first_name: "CeeDee",
    last_name: "Lamb",
    position: "WR",
    jersey_number: 88,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["ceedee", "lamb", "cee dee", "ceedee lamb", "wr"]
  },
  {
    player_id: "micah_parsons",
    player_name: "Micah Parsons",
    first_name: "Micah",
    last_name: "Parsons",
    position: "LB",
    jersey_number: 11,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "defense",
    starter: true,
    searchable: ["micah", "parsons", "micah parsons", "lb", "edge"]
  },
  {
    player_id: "brandin_cooks",
    player_name: "Brandin Cooks",
    first_name: "Brandin",
    last_name: "Cooks",
    position: "WR",
    jersey_number: 3,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["brandin", "cooks", "brandin cooks", "wr"]
  },
  {
    player_id: "ezekiel_elliott",
    player_name: "Ezekiel Elliott",
    first_name: "Ezekiel",
    last_name: "Elliott",
    position: "RB",
    jersey_number: 15,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: false,
    searchable: ["ezekiel", "elliott", "zeke", "ezekiel elliott", "rb"]
  },
  {
    player_id: "daron_bland",
    player_name: "Daron Bland",
    first_name: "Daron",
    last_name: "Bland",
    position: "CB",
    jersey_number: 26,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "defense",
    starter: true,
    searchable: ["daron", "bland", "daron bland", "cb"]
  },
  {
    player_id: "trevon_diggs",
    player_name: "Trevon Diggs",
    first_name: "Trevon",
    last_name: "Diggs",
    position: "CB",
    jersey_number: 7,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "defense",
    starter: true,
    searchable: ["trevon", "diggs", "trevon diggs", "cb"]
  },
  {
    player_id: "demarcus_lawrence",
    player_name: "DeMarcus Lawrence",
    first_name: "DeMarcus",
    last_name: "Lawrence",
    position: "DE",
    jersey_number: 90,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "defense",
    starter: true,
    searchable: ["demarcus", "lawrence", "tank", "tank lawrence", "de"]
  },
  {
    player_id: "jake_ferguson",
    player_name: "Jake Ferguson",
    first_name: "Jake",
    last_name: "Ferguson",
    position: "TE",
    jersey_number: 87,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["jake", "ferguson", "jake ferguson", "te"]
  },
  {
    player_id: "tyler_smith",
    player_name: "Tyler Smith",
    first_name: "Tyler",
    last_name: "Smith",
    position: "OL",
    jersey_number: 73,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["tyler", "smith", "tyler smith", "guard", "tackle", "ol"]
  },
  {
    player_id: "terence_steele",
    player_name: "Terence Steele",
    first_name: "Terence",
    last_name: "Steele",
    position: "OT",
    jersey_number: 78,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "offense",
    starter: true,
    searchable: ["terence", "steele", "terence steele", "ot"]
  },
  {
    player_id: "dauron_payne_placeholder",
    player_name: "Brandon Aubrey",
    first_name: "Brandon",
    last_name: "Aubrey",
    position: "K",
    jersey_number: 17,
    team: "DAL",
    team_name: "Dallas Cowboys",
    side: "special_teams",
    starter: true,
    searchable: ["brandon", "aubrey", "brandon aubrey", "kicker", "k"]
  }
];

function normalizeSeason(value, fallback = new Date().getFullYear()) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 3000 ? year : fallback;
}

function normalizeLimit(value, fallback = 50, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeQuery(value) {
  return asString(value).toLowerCase();
}

function scoreCowboysFallbackPlayer(player, query) {
  if (!query) return 0;

  const exactName = normalizeQuery(player.player_name);
  if (exactName === query) return 100;

  const exactFirst = normalizeQuery(player.first_name);
  const exactLast = normalizeQuery(player.last_name);
  if (exactFirst === query || exactLast === query) return 90;

  if (safeArray(player.searchable).some((term) => normalizeQuery(term) === query)) {
    return 85;
  }

  if (exactName.startsWith(query)) return 75;
  if (exactFirst.startsWith(query) || exactLast.startsWith(query)) return 70;

  if (exactName.includes(query)) return 60;

  if (safeArray(player.searchable).some((term) => normalizeQuery(term).includes(query))) {
    return 55;
  }

  return 0;
}

function searchRealCowboysPlayers(query, limit = 20) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return REAL_COWBOYS_PLAYERS.slice(0, limit);
  }

  return REAL_COWBOYS_PLAYERS
    .map((player) => ({
      ...player,
      _score: scoreCowboysFallbackPlayer(player, normalized)
    }))
    .filter((player) => player._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return a.player_name.localeCompare(b.player_name);
    })
    .slice(0, limit)
    .map(({ _score, ...player }) => player);
}

function mapTimelineEventToPlayerEvent(event) {
  return {
    id: event.id,
    player_id: event.playerId,
    player_name: event.playerName,
    event_type: event.eventType,
    event_date: event.date,
    description: event.description,
    impact_score: event.impact,
    severity: event.severity,
    source: event.source,
    title: event.title,
    team: event.team,
    confidence: event.confidence,
    metadata: event.metadata
  };
}

async function searchPlayersFromDatabase(query) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return [];
  }

  const dbResult = await pool.query(
    `
    SELECT DISTINCT
      CAST(player_id AS TEXT) AS player_id,
      player_name
    FROM player_events
    WHERE player_name ILIKE $1
    ORDER BY player_name ASC
    LIMIT 20
    `,
    [`%${query}%`]
  );

  return safeArray(dbResult.rows).map((row) => ({
    player_id: row.player_id || normalizeQuery(row.player_name).replace(/\s+/g, "_"),
    player_name: row.player_name,
    first_name: asString(row.player_name).split(" ").slice(0, -1).join(" ") || row.player_name,
    last_name: asString(row.player_name).split(" ").slice(-1).join(" "),
    team: "DAL",
    team_name: "Dallas Cowboys",
    source: "database"
  }));
}

// GET /api/players/search
router.get("/search", async (req, res) => {
  try {
    const query = asString(req.query.name || req.query.q);
    const limit = normalizeLimit(req.query.limit, 20, 50);

    if (!query) {
      return res.json([]);
    }

    const cacheKey = JSON.stringify({
      q: normalizeQuery(query),
      limit
    });

    const cached = await cache.get("PLAYER_SEARCH", cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let results = [];

    try {
      const dbPlayers = await searchPlayersFromDatabase(query);
      results = dbPlayers.slice(0, limit);
    } catch (err) {
      console.warn("Player search DB query failed, using Cowboys fallback:", err.message);
    }

    if (!results.length) {
      results = searchRealCowboysPlayers(query, limit).map((player) => ({
        ...player,
        source: "fallback_cowboys_roster"
      }));
    }

    await cache.set("PLAYER_SEARCH", results, null, cacheKey);
    res.json(results);
  } catch (error) {
    console.error("Player search error:", error);
    res.status(500).json({ error: "Search failed", message: error.message });
  }
});

// POST /api/players/events
router.post("/events", async (req, res) => {
  try {
    const {
      player_id,
      player_name,
      event_type,
      event_date,
      description,
      impact_score,
      season
    } = req.body || {};

    if (!player_name || !event_type || !event_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedSeason = normalizeSeason(
      season,
      new Date(event_date).getFullYear() || new Date().getFullYear()
    );

    const result = await pool.query(
      `
      INSERT INTO player_events (
        player_id,
        player_name,
        event_type,
        event_date,
        description,
        impact_score,
        season
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (player_name, event_date, event_type)
      DO UPDATE SET
        player_id = EXCLUDED.player_id,
        description = EXCLUDED.description,
        impact_score = EXCLUDED.impact_score,
        season = EXCLUDED.season,
        updated_at = NOW()
      RETURNING *
      `,
      [
        player_id || null,
        player_name,
        event_type,
        event_date,
        description || null,
        impact_score ?? null,
        normalizedSeason
      ]
    );

    await cache.clearNamespace("PLAYER_EVENTS");
    await cache.clearNamespace("PLAYER_SEARCH");
    await cache.clearNamespace("TIMELINE_POINTS");
    await cache.clearNamespace("TIMELINE_INFLECTIONS");

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Event creation error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/players/events
router.get("/events", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season, 2025);
    const limit = normalizeLimit(req.query.limit, 50, 500);
    const playerId =
      req.query.playerId !== undefined && req.query.playerId !== null
        ? String(req.query.playerId)
        : null;
    const severity = asString(req.query.severity).toLowerCase();
    const source = asString(req.query.source).toLowerCase();
    const minAbsImpact =
      req.query.minAbsImpact !== undefined ? Number(req.query.minAbsImpact) || 0 : 0;

    const cacheKey = JSON.stringify({
      season,
      limit,
      playerId,
      severity,
      source,
      minAbsImpact
    });

    const cached = await cache.get("PLAYER_EVENTS", cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    const timelineData = await getTimelineEvents({
      season,
      playerId,
      severity,
      source,
      minAbsImpact
    });

    const events = safeArray(timelineData.events)
      .slice(0, limit)
      .map(mapTimelineEventToPlayerEvent);

    const responseData = {
      events,
      season,
      count: events.length,
      dataUnavailable: Boolean(timelineData.dataUnavailable),
      reason: timelineData.reason || null
    };

    await cache.set("PLAYER_EVENTS", responseData, 120, cacheKey);

    res.json({ ...responseData, _cached: false });
  } catch (error) {
    console.error("Events fetch error:", error);
    res.status(500).json({ error: "Failed to fetch events", message: error.message });
  }
});

// GET /api/players/roster
router.get("/roster", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit, REAL_COWBOYS_PLAYERS.length, 100);
    const q = asString(req.query.q || req.query.name);

    const players = q
      ? searchRealCowboysPlayers(q, limit)
      : REAL_COWBOYS_PLAYERS.slice(0, limit);

    res.json({
      team: "DAL",
      team_name: "Dallas Cowboys",
      count: players.length,
      players
    });
  } catch (error) {
    console.error("Roster fetch error:", error);
    res.status(500).json({ error: "Failed to fetch roster", message: error.message });
  }
});

module.exports = router;
