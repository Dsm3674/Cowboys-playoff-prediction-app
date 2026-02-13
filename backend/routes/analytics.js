const express = require("express");
const router = express.Router();
const cache = require("../cache");

const { computeWinProbability } = require("../winprob");
const { computeTSI } = require("../tsi");
const { buildSeasonPaths, computeMustWinGames } = require("../seasonPath");
const { computeRivalImpact } = require("../rivalAnalysis");


router.post("/winprob", (req, res) => {
  try {
    const wp = computeWinProbability(req.body);
    res.json({ success: true, winProbability: wp });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});


router.get("/tsi", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const out = await computeTSI({ teamAbbr: team, year });
    res.json({ success: true, ...out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


router.get("/paths", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const k = Math.min(60, Math.max(5, Number(req.query.k) || 25));
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));

    const data = await buildSeasonPaths({ teamAbbr: team, year, k, chaos });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


router.get("/mustwin", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));

    const games = await computeMustWinGames({ teamAbbr: team, year, chaos });
    res.json({ success: true, games });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


router.get("/rivalimpact", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));
    const iterations = Math.min(5000, Math.max(100, Number(req.query.iterations) || 1000));

    const result = await computeRivalImpact({ year, chaos, iterations });
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/analytics/cache-stats - Cache metrics (JSON)
router.get("/cache-stats", async (req, res) => {
  try {
    const metrics = cache.getMetrics();
    const keys = await cache.keys("*");
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: {
        hits: metrics.hits,
        misses: metrics.misses,
        hitRate: metrics.hitRate,
        sets: metrics.sets,
        deletes: metrics.deletes,
        errors: metrics.errors,
        size: metrics.size,
        backend: metrics.backend,
        redisConnected: metrics.redisConnected,
      },
      keys: keys.slice(0, 50), // First 50 keys
      totalKeys: keys.length,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/analytics/metrics - Prometheus-style metrics (plaintext)
router.get("/metrics", async (req, res) => {
  try {
    const cacheMetrics = cache.getMetrics();
    
    // Build Prometheus-style metrics
    let output = "# HELP cache_hits_total Cache hit count\n";
    output += "# TYPE cache_hits_total counter\n";
    output += `cache_hits_total ${cacheMetrics.hits}\n\n`;
    
    output += "# HELP cache_misses_total Cache miss count\n";
    output += "# TYPE cache_misses_total counter\n";
    output += `cache_misses_total ${cacheMetrics.misses}\n\n`;
    
    output += "# HELP cache_hit_rate Cache hit rate percentage\n";
    output += "# TYPE cache_hit_rate gauge\n";
    output += `cache_hit_rate ${parseFloat(cacheMetrics.hitRate)}\n\n`;
    
    output += "# HELP cache_keys Cache stored keys count\n";
    output += "# TYPE cache_keys gauge\n";
    output += `cache_keys ${cacheMetrics.size}\n\n`;
    
    output += "# HELP cache_errors Cache operation errors\n";
    output += "# TYPE cache_errors counter\n";
    output += `cache_errors ${cacheMetrics.errors}\n\n`;
    
    output += "# HELP cache_backend Cache backend (0=memory, 1=redis)\n";
    output += "# TYPE cache_backend gauge\n";
    output += `cache_backend ${cacheMetrics.backend === "redis" ? 1 : 0}\n\n`;

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(output);
  } catch (e) {
    res.status(500).send(`# ERROR: ${e.message}`);
  }
});

module.exports = router;
