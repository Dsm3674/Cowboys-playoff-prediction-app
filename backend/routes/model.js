"use strict";

const express = require("express");
const router = express.Router();

const {
  getPowerRatings,
  listAdjustments,
  upsertAdjustment,
  removeAdjustments,
  _invalidateRatingsCache,
} = require("../services/ratingsEngine");
const {
  simulatePlayoffPaths,
  MAX_ITERATIONS,
} = require("../services/playoffPathEngine");
const {
  getFutures,
  saveFutures,
  validateAgainstMarket,
} = require("../services/marketValidation");

// Mutations (adjustments, futures updates) are gated the same way as the
// War Room admin endpoints: MODEL_ADMIN_KEY must be set and match.
function requireAdmin(req, res, next) {
  const adminKey = process.env.MODEL_ADMIN_KEY || "";
  if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
    return res.status(403).json({ success: false, error: "Admin key required." });
  }
  next();
}

/* ── Power ratings ─────────────────────────────────────────────────────── */

router.get("/power-ratings", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const data = await getPowerRatings({ year });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ── Path probabilities (conditional playoff outcomes) ─────────────────── */

router.get("/path-probabilities", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const focusTeam = String(req.query.team || "DAL").toUpperCase();
    const iterations = Number(req.query.iterations) || undefined;
    const seed = Number(req.query.seed) || undefined;

    const data = await simulatePlayoffPaths({ year, focusTeam, iterations, seed });
    res.json({ success: true, maxIterations: MAX_ITERATIONS, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ── Market futures validation ─────────────────────────────────────────── */

router.get("/market-validation", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const iterations = Number(req.query.iterations) || undefined;
    const data = await validateAgainstMarket({ year, iterations });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/market-futures", async (req, res) => {
  res.json({
    success: true,
    liveFeed: Boolean(process.env.ODDS_API_KEY),
    futures: await getFutures(),
  });
});

router.post("/market-futures", requireAdmin, (req, res) => {
  try {
    const snapshot = saveFutures(req.body || {});
    res.json({ success: true, futures: snapshot });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

/* ── QB / injury rating adjustments ────────────────────────────────────── */

router.get("/adjustments", (req, res) => {
  res.json({ success: true, adjustments: listAdjustments() });
});

router.post("/adjustments", requireAdmin, (req, res) => {
  try {
    const adjustment = upsertAdjustment(req.body || {});
    _invalidateRatingsCache();
    res.json({ success: true, adjustment });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete("/adjustments/:team", requireAdmin, (req, res) => {
  const removed = removeAdjustments(req.params.team);
  _invalidateRatingsCache();
  res.json({ success: true, removed });
});

module.exports = router;
