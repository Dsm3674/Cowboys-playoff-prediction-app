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

function toOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
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

function buildBaseFilters(query) {
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

function buildProjectionOptions(query) {
  return {
    includeEvents: toOptionalBoolean(query.includeEvents),
    includePoints: toOptionalBoolean(query.includePoints),
    includeInflectionPoints: toOptionalBoolean(query.includeInflectionPoints),
    includeSummary: toOptionalBoolean(query.includeSummary),
    includeFilters: toOptionalBoolean(query.includeFilters),
    limit: normalizeLimit(query.limit)
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
        const child = value[key];
        if (child !== undefined) {
          sorted[key] = stableObject(child);
        }
      });
    return sorted;
  }

  return value;
}

function makeCacheKey(namespace, payload) {
  return `${namespace}:${JSON.stringify(stableObject(payload))}`;
}

function projectTimelineData(data, options = {}) {
  const includeEvents =
    options.includeEvents === null || options.includeEvents === undefined
      ? true
      : Boolean(options.includeEvents);

  const includePoints =
    options.includePoints === null || options.includePoints === undefined
      ? true
      : Boolean(options.includePoints);

  const includeInflectionPoints =
    options.includeInflectionPoints === null ||
    options.includeInflectionPoints === undefined
      ? true
      : Boolean(options.includeInflectionPoints);

  const includeSummary =
    options.includeSummary === null || options.includeSummary === undefined
      ? true
      : Boolean(options.includeSummary);

  const includeFilters =
    options.includeFilters === null || options.includeFilters === undefined
      ? true
      : Boolean(options.includeFilters);

  const limit = normalizeLimit(options.limit);

  const response = {
    season: data.season,
    dataUnavailable: Boolean(data.dataUnavailable),
    reason: data.reason || null,
    synthetic: Boolean(data.synthetic),
    eventCount: Number(data.eventCount || 0),
    pointCount: Number(data.pointCount || 0)
  };

  if (includeFilters) {
    response.filters = data.filters || {};
  }

  if (includeSummary) {
    response.summary = data.summary || {
      netImpact: 0,
      trend: "flat",
      positiveEvents: 0,
      negativeEvents: 0,
      neutralEvents: 0
    };
  }

  if (includePoints) {
    response.points = Array.isArray(data.points) ? data.points : [];
  }

  if (includeInflectionPoints) {
    response.inflectionPoints = Array.isArray(data.inflectionPoints)
      ? data.inflectionPoints
      : [];
  }

  if (includeEvents) {
    response.events = Array.isArray(data.events) ? data.events.slice(0, limit) : [];
  }

  return response;
}

function projectInflectionData(data) {
  return {
    season: data.season,
    filters: data.filters || {},
    inflectionPoints: Array.isArray(data.inflectionPoints) ? data.inflectionPoints : [],
    dataUnavailable: Boolean(data.dataUnavailable),
    reason: data.reason || null,
    summary: data.summary || {
      netImpact: 0,
      trend: "flat"
    }
  };
}

function projectEventsData(data, limit) {
  return {
    season: data.season,
    filters: data.filters || {},
    events: Array.isArray(data.events) ? data.events.slice(0, limit) : [],
    eventCount: Number(data.eventCount || 0),
    dataUnavailable: Boolean(data.dataUnavailable),
    reason: data.reason || null
  };
}

function buildMetrics(data) {
  const events = Array.isArray(data.events) ? data.events : [];
  const points = Array.isArray(data.points) ? data.points : [];
  const inflectionPoints = Array.isArray(data.inflectionPoints) ? data.inflectionPoints : [];

  const positiveEvents = events.filter((event) => Number(event.impact || 0) > 0).length;
  const negativeEvents = events.filter((event) => Number(event.impact || 0) < 0).length;
  const neutralEvents = events.filter((event) => Number(event.impact || 0) === 0).length;

  const highSeverityEvents = events.filter((event) => event.severity === "high").length;
  const mediumSeverityEvents = events.filter((event) => event.severity === "medium").length;
  const lowSeverityEvents = events.filter((event) => event.severity === "low").length;

  const sources = uniqueStrings(events.map((event) => event.source).filter(Boolean));
  const eventTypes = uniqueStrings(events.map((event) => event.eventType).filter(Boolean));
  const players = uniqueStrings(events.map((event) => event.playerName).filter(Boolean));

  const firstPoint = points.length ? points[0] : null;
  const lastPoint = points.length ? points[points.length - 1] : null;

  const peakPoint = points.length
    ? points.reduce((best, point) =>
        Number(point.value || 0) > Number(best.value || 0) ? point : best
      )
    : null;

  const valleyPoint = points.length
    ? points.reduce((best, point) =>
        Number(point.value || 0) < Number(best.value || 0) ? point : best
      )
    : null;

  return {
    counts: {
      events: events.length,
      points: points.length,
      inflectionPoints: inflectionPoints.length,
      positiveEvents,
      negativeEvents,
      neutralEvents,
      highSeverityEvents,
      mediumSeverityEvents,
      lowSeverityEvents
    },
    coverage: {
      sources,
      sourceCount: sources.length,
      eventTypes,
      eventTypeCount: eventTypes.length,
      players,
      playerCount: players.length
    },
    shape: {
      firstPointDate: firstPoint ? firstPoint.date : null,
      lastPointDate: lastPoint ? lastPoint.date : null,
      firstPointValue: firstPoint ? Number(firstPoint.value || 0) : null,
      lastPointValue: lastPoint ? Number(lastPoint.value || 0) : null,
      peakDate: peakPoint ? peakPoint.date : null,
      peakValue: peakPoint ? Number(peakPoint.value || 0) : null,
      valleyDate: valleyPoint ? valleyPoint.date : null,
      valleyValue: valleyPoint ? Number(valleyPoint.value || 0) : null
    }
  };
}

async function loadCachedOrFresh(namespace, keyPayload, loader) {
  const cacheKey = makeCacheKey(namespace, keyPayload);
  const cached = await cache.get(namespace, cacheKey);

  if (cached) {
    return {
      data: cached,
      cached: true,
      cacheKey
    };
  }

  const fresh = await loader();

  await cache.set(namespace, fresh, CACHE_TTL_SECONDS, cacheKey);

  return {
    data: fresh,
    cached: false,
    cacheKey
  };
}

function failIfServiceError(res, payload) {
  if (payload && payload.error) {
    res.status(500).json({
      success: false,
      error: payload.error
    });
    return true;
  }

  return false;
}

router.get("/points", async (req, res) => {
  try {
    const filters = buildBaseFilters(req.query);
    const options = buildProjectionOptions(req.query);

    const { data, cached } = await loadCachedOrFresh(
      "TIMELINE_POINTS",
      {
        route: "points",
        filters
      },
      async () => {
        const timelineData = await timeline.getTimelineData(filters);
        return projectTimelineData(timelineData, options);
      }
    );

    if (failIfServiceError(res, data)) {
      return;
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
    const filters = buildBaseFilters(req.query);

    const { data, cached } = await loadCachedOrFresh(
      "TIMELINE_INFLECTIONS",
      {
        route: "inflections",
        filters
      },
      async () => {
        const inflectionData = await timeline.getInflectionPoints(filters);
        return projectInflectionData(inflectionData);
      }
    );

    if (failIfServiceError(res, data)) {
      return;
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
    const filters = buildBaseFilters(req.query);
    const limit = normalizeLimit(req.query.limit);

    const { data, cached } = await loadCachedOrFresh(
      "TIMELINE_EVENTS",
      {
        route: "events",
        filters,
        limit
      },
      async () => {
        const eventsData = await timeline.getTimelineEvents(filters);
        return projectEventsData(eventsData, limit);
      }
    );

    if (failIfServiceError(res, data)) {
      return;
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
    const filters = buildBaseFilters(req.query);

    const { data, cached } = await loadCachedOrFresh(
      "TIMELINE_OVERVIEW",
      {
        route: "overview",
        filters
      },
      async () => {
        const timelineData = await timeline.getTimelineData(filters);
        return {
          season: timelineData.season,
          filters: timelineData.filters || {},
          summary: timelineData.summary || {
            netImpact: 0,
            trend: "flat",
            positiveEvents: 0,
            negativeEvents: 0,
            neutralEvents: 0
          },
          metrics: buildMetrics(timelineData),
          dataUnavailable: Boolean(timelineData.dataUnavailable),
          reason: timelineData.reason || null,
          synthetic: Boolean(timelineData.synthetic),
          eventCount: Number(timelineData.eventCount || 0),
          pointCount: Number(timelineData.pointCount || 0)
        };
      }
    );

    if (failIfServiceError(res, data)) {
      return;
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

router.get("/range", async (req, res) => {
  try {
    const filters = buildBaseFilters(req.query);

    const { data, cached } = await loadCachedOrFresh(
      "TIMELINE_RANGE",
      {
        route: "range",
        filters
      },
      async () => {
        const timelineData = await timeline.getTimelineData(filters);
        const points = Array.isArray(timelineData.points) ? timelineData.points : [];
        const firstPoint = points.length ? points[0] : null;
        const lastPoint = points.length ? points[points.length - 1] : null;

        return {
          season: timelineData.season,
          filters: timelineData.filters || {},
          startDate: firstPoint ? firstPoint.date : null,
          endDate: lastPoint ? lastPoint.date : null,
          pointCount: points.length,
          eventCount: Number(timelineData.eventCount || 0),
          dataUnavailable: Boolean(timelineData.dataUnavailable),
          reason: timelineData.reason || null
        };
      }
    );

    if (failIfServiceError(res, data)) {
      return;
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
