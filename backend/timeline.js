"use strict";

const express = require("express");
const router = express.Router();

const timeline = require("../timeline");
const cache = require("../cache");

function normalizeSeason(value) {
  const year = Number(value);
  if (Number.isInteger(year) && year >= 1900 && year <= 3000) return year;
  return new Date().getFullYear();
}

function normalizeLimit(value, fallback = 50, max = 500) {
  const parsed = parseInt(value);
  if (!parsed || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeBoolean(value) {
  if (value === true || value === "true" || value === "1") return true;
  return false;
}

function buildCacheKey(prefix, params) {
  return `${prefix}:${params.join(":")}`;
}

function buildResponse(data, season) {
  return {
    season,
    points: safeArray(data.points),
    events: safeArray(data.events),
    inflectionPoints: safeArray(data.inflectionPoints),
    summary: safeObject(data.summary),
    dataUnavailable: Boolean(data.dataUnavailable),
    reason: data.reason || null
  };
}

async function fetchTimelinePoints(season, forceRefresh) {
  const key = buildCacheKey("TIMELINE_POINTS", [season]);

  if (forceRefresh) {
    return timeline.getTimelineData({ season });
  }

  return cache.getOrCompute(
    key,
    () => timeline.getTimelineData({ season }),
    { ttl: 300 }
  );
}

async function fetchTimelineEvents(season, limit, forceRefresh) {
  const key = buildCacheKey("TIMELINE_EVENTS", [season]);

  let data;

  if (forceRefresh) {
    data = await timeline.getTimelineEvents({ season });
  } else {
    data = await cache.getOrCompute(
      key,
      () => timeline.getTimelineEvents({ season }),
      { ttl: 300 }
    );
  }

  const events = safeArray(data.events).slice(0, limit);

  return {
    ...data,
    events
  };
}

async function fetchInflectionPoints(season, forceRefresh) {
  const key = buildCacheKey("TIMELINE_INFLECTION", [season]);

  if (forceRefresh) {
    return timeline.getInflectionPoints({ season });
  }

  return cache.getOrCompute(
    key,
    () => timeline.getInflectionPoints({ season }),
    { ttl: 300 }
  );
}

router.get("/points", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const forceRefresh = normalizeBoolean(req.query.refresh);

    const data = await fetchTimelinePoints(season, forceRefresh);

    const response = buildResponse(data, season);

    response.points = safeArray(data.points);
    response.inflectionPoints = safeArray(data.inflectionPoints);

    res.json(response);

  } catch (err) {
    console.error("timeline points error:", err);
    res.status(500).json({
      error: "Failed to fetch timeline points",
      details: err.message
    });
  }
});

router.get("/events", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const limit = normalizeLimit(req.query.limit);
    const forceRefresh = normalizeBoolean(req.query.refresh);

    const data = await fetchTimelineEvents(season, limit, forceRefresh);

    res.json({
      season,
      events: safeArray(data.events),
      count: safeArray(data.events).length,
      dataUnavailable: Boolean(data.dataUnavailable),
      reason: data.reason || null
    });

  } catch (err) {
    console.error("timeline events error:", err);
    res.status(500).json({
      error: "Failed to fetch timeline events",
      details: err.message
    });
  }
});

router.get("/inflection", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const forceRefresh = normalizeBoolean(req.query.refresh);

    const data = await fetchInflectionPoints(season, forceRefresh);

    res.json({
      season,
      inflectionPoints: safeArray(data.inflectionPoints),
      summary: safeObject(data.summary),
      dataUnavailable: Boolean(data.dataUnavailable),
      reason: data.reason || null
    });

  } catch (err) {
    console.error("timeline inflection error:", err);
    res.status(500).json({
      error: "Failed to fetch inflection points",
      details: err.message
    });
  }
});

router.get("/full", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const limit = normalizeLimit(req.query.limit);
    const forceRefresh = normalizeBoolean(req.query.refresh);

    const [pointsData, eventsData, inflectionData] = await Promise.all([
      fetchTimelinePoints(season, forceRefresh),
      fetchTimelineEvents(season, limit, forceRefresh),
      fetchInflectionPoints(season, forceRefresh)
    ]);

    const merged = {
      season,
      points: safeArray(pointsData.points),
      events: safeArray(eventsData.events),
      inflectionPoints: safeArray(inflectionData.inflectionPoints),
      summary: safeObject(pointsData.summary),
      dataUnavailable:
        Boolean(pointsData.dataUnavailable) &&
        Boolean(eventsData.dataUnavailable),
      reason:
        pointsData.reason ||
        eventsData.reason ||
        inflectionData.reason ||
        null
    };

    res.json(merged);

  } catch (err) {
    console.error("timeline full error:", err);
    res.status(500).json({
      error: "Failed to fetch full timeline",
      details: err.message
    });
  }
});

module.exports = router;
