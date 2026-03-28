"use strict";

const express = require("express");
const router = express.Router();
const timeline = require("../timeline");
const cache = require("../cache");

const CACHE_TTL_SECONDS = 600;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function normalizeSeason(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 3000
    ? year
    : new Date().getFullYear();
}

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toOptionalString(value) {
  const str = asString(value);
  return str ? str : null;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toOptionalArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeLimit(value, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function buildFilters(query) {
  return {
    season: normalizeSeason(query.season),
    team: toOptionalString(query.team),
    playerId: toOptionalString(query.playerId),
    startDate: toOptionalString(query.startDate),
    endDate: toOptionalString(query.endDate),
    eventTypes: uniqueStrings(toOptionalArray(query.eventTypes)),
    severity: toOptionalString(query.severity),
    source: toOptionalString(query.source),
    minAbsImpact: toOptionalNumber(query.minAbsImpact)
  };
}

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }

  if (value && typeof value === "object") {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        if (value[key] !== undefined) {
          sorted[key] = stableObject(value[key]);
        }
      });
    return sorted;
  }

  return value;
}

function makeCacheKey(namespace, payload) {
  return `${namespace}:${JSON.stringify(stableObject(payload))}`;
}

async function readOrWriteCache(namespace, payload, loader) {
  const cacheKey = makeCacheKey(namespace, payload);
  const cached = await cache.get(namespace, cacheKey);

  if (cached) {
    return {
      data: cached,
      cached: true
    };
  }

  const fresh = await loader();
  await cache.set(namespace, fresh, CACHE_TTL_SECONDS, cacheKey);

  return {
    data: fresh,
    cached: false
  };
}

function normalizeTimelineResponse(data) {
  return {
    season: data?.season ?? new Date().getFullYear(),
    filters: data?.filters || {},
    points: Array.isArray(data?.points) ? data.points : [],
    events: Array.isArray(data?.events) ? data.events : [],
    inflectionPoints: Array.isArray(data?.inflectionPoints) ? data.inflectionPoints : [],
    summary: data?.summary || {
      netImpact: 0,
      trend: "flat",
      positiveEvents: 0,
      negativeEvents: 0,
      neutralEvents: 0
    },
    eventCount: Number(data?.eventCount || 0),
    pointCount: Number(data?.pointCount || 0),
    synthetic: Boolean(data?.synthetic),
    dataUnavailable: Boolean(data?.dataUnavailable),
    reason: data?.reason || null,
    error: data?.error || null
  };
}

function normalizeInflectionResponse(data) {
  return {
    season: data?.season ?? new Date().getFullYear(),
    filters: data?.filters || {},
    inflectionPoints: Array.isArray(data?.inflectionPoints) ? data.inflectionPoints : [],
    dataUnavailable: Boolean(data?.dataUnavailable),
    reason: data?.reason || null,
    summary: data?.summary || {
      netImpact: 0,
      trend: "flat"
    },
    error: data?.error || null
  };
}

function normalizeEventsResponse(data, limit) {
  const events = Array.isArray(data?.events) ? data.events.slice(0, limit) : [];

  return {
    season: data?.season ?? new Date().getFullYear(),
    filters: data?.filters || {},
    events,
    eventCount: Number(data?.eventCount || events.length),
    dataUnavailable: Boolean(data?.dataUnavailable),
    reason: data?.reason || null,
    error: data?.error || null
  };
}

function buildOverviewResponse(data) {
  const timelineData = normalizeTimelineResponse(data);

  const positiveEvents = timelineData.events.filter((event) => Number(event.impact || 0) > 0).length;
  const negativeEvents = timelineData.events.filter((event) => Number(event.impact || 0) < 0).length;
  const neutralEvents = timelineData.events.filter((event) => Number(event.impact || 0) === 0).length;

  const highSeverityEvents = timelineData.events.filter((event) => event.severity === "high").length;
  const mediumSeverityEvents = timelineData.events.filter((event) => event.severity === "medium").length;
  const lowSeverityEvents = timelineData.events.filter((event) => event.severity === "low").length;

  const players = uniqueStrings(
    timelineData.events.map((event) => event.playerName).filter(Boolean)
  );

  const eventTypes = uniqueStrings(
    timelineData.events.map((event) => event.eventType).filter(Boolean)
  );

  const sources = uniqueStrings(
    timelineData.events.map((event) => event.source).filter(Boolean)
  );

  const firstPoint = timelineData.points.length ? timelineData.points[0] : null;
  const lastPoint = timelineData.points.length
    ? timelineData.points[timelineData.points.length - 1]
    : null;

  return {
    season: timelineData.season,
    filters: timelineData.filters,
    summary: timelineData.summary,
    counts: {
      events: timelineData.eventCount,
      points: timelineData.pointCount,
      inflectionPoints: timelineData.inflectionPoints.length,
      positiveEvents,
      negativeEvents,
      neutralEvents,
      highSeverityEvents,
      mediumSeverityEvents,
      lowSeverityEvents
    },
    coverage: {
      players,
      playerCount: players.length,
      eventTypes,
      eventTypeCount: eventTypes.length,
      sources,
      sourceCount: sources.length
    },
    range: {
      startDate: firstPoint ? firstPoint.date : null,
      endDate: lastPoint ? lastPoint.date : null,
      startValue: firstPoint ? Number(firstPoint.value || 0) : null,
      endValue: lastPoint ? Number(lastPoint.value || 0) : null
    },
    dataUnavailable: timelineData.dataUnavailable,
    reason: timelineData.reason,
    synthetic: timelineData.synthetic,
    error: timelineData.error
  };
}

router.get("/points", async (req, res) => {
  try {
    const filters = buildFilters(req.query);

    const { data, cached } = await readOrWriteCache(
      "TIMELINE_POINTS",
      {
        route: "points",
        filters
      },
      async () => {
        const raw = await timeline.getTimelineData(filters);
        return normalizeTimelineResponse(raw);
      }
    );

    if (data.error) {
      return res.status(500).json({
        success: false,
        error: data.error
      });
    }

    return res.json({
      ...data,
      _cached: cached
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get("/inflections", async (req, res) => {
  try {
    const filters = buildFilters(req.query);

    const { data, cached } = await readOrWriteCache(
      "TIMELINE_INFLECTIONS",
      {
        route: "inflections",
        filters
      },
      async () => {
        const raw = await timeline.getInflectionPoints(filters);
        return normalizeInflectionResponse(raw);
      }
    );

    if (data.error) {
      return res.status(500).json({
        success: false,
        error: data.error
      });
    }

    return res.json({
      ...data,
      _cached: cached
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get("/events", async (req, res) => {
  try {
    const filters = buildFilters(req.query);
    const limit = normalizeLimit(req.query.limit);

    const { data, cached } = await readOrWriteCache(
      "TIMELINE_EVENTS",
      {
        route: "events",
        filters,
        limit
      },
      async () => {
        const raw = await timeline.getTimelineEvents(filters);
        return normalizeEventsResponse(raw, limit);
      }
    );

    if (data.error) {
      return res.status(500).json({
        success: false,
        error: data.error
      });
    }

    return res.json({
      ...data,
      _cached: cached
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get("/overview", async (req, res) => {
  try {
    const filters = buildFilters(req.query);

    const { data, cached } = await readOrWriteCache(
      "TIMELINE_OVERVIEW",
      {
        route: "overview",
        filters
      },
      async () => {
        const raw = await timeline.getTimelineData(filters);
        return buildOverviewResponse(raw);
      }
    );

    if (data.error) {
      return res.status(500).json({
        success: false,
        error: data.error
      });
    }

    return res.json({
      ...data,
      _cached: cached
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
