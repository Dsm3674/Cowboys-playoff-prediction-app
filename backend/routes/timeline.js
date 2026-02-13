/**
 * routes/timeline.js - Timeline API endpoints
 */

const express = require("express");
const router = express.Router();
const timeline = require("../timeline");
const cache = require("../cache");

// GET /api/timeline/points - Get timeline points with inflection detection
router.get("/points", async (req, res) => {
  try {
    const season = Number(req.query.season) || new Date().getFullYear();

    // Check cache first
    const cacheKey = `timeline_${season}`;
    const cached = await cache.get("TIMELINE_POINTS", cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    // Fetch timeline data
    const timelineData = await timeline.getTimelineData(season);

    if (timelineData.error) {
      return res.status(500).json({
        success: false,
        error: timelineData.error,
      });
    }

    // Cache for 10 minutes
    await cache.set("TIMELINE_POINTS", cacheKey, timelineData, 600);

    res.json({ ...timelineData, _cached: false });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// GET /api/timeline/inflections - Get inflection points only
router.get("/inflections", async (req, res) => {
  try {
    const season = Number(req.query.season) || new Date().getFullYear();

    // Check cache first
    const cacheKey = `inflections_${season}`;
    const cached = await cache.get("TIMELINE_POINTS", cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    // Fetch inflection points
    const inflectionData = await timeline.getInflectionPoints(season);

    // Cache for 10 minutes
    await cache.set("TIMELINE_POINTS", cacheKey, inflectionData, 600);

    res.json({ ...inflectionData, _cached: false });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
