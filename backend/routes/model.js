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
  simulateSeason,
  getSeasonSimulation,
  publicTeam,
  DEFAULT_ITERATIONS: SEASON_DEFAULT_ITERATIONS,
  MAX_ITERATIONS: SEASON_MAX_ITERATIONS,
  _invalidateSimulationCache,
} = require("../services/seasonSimulator");
const { runBacktest, DEFAULT_CHECKPOINTS } = require("../services/backtest");
const { getNFLSeasonYear } = require("../services/espn");
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

/* ── League season simulation ──────────────────────────────────────────── */

// Plays out the rest of the regular season for all 32 teams, then the
// playoffs. Default settings share the cached run the other pages use; a
// custom iteration count or seed runs fresh.
router.get("/season-simulation", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const iterations = Number(req.query.iterations) || SEASON_DEFAULT_ITERATIONS;
    const seed = Number(req.query.seed) || undefined;
    const focus = String(req.query.team || "DAL").toUpperCase();

    const custom = iterations !== SEASON_DEFAULT_ITERATIONS || seed !== undefined;
    const sim = custom
      ? await simulateSeason({ year, iterations, seed })
      : await getSeasonSimulation({ year });

    res.json({
      success: true,
      maxIterations: SEASON_MAX_ITERATIONS,
      ...sim,
      focusTeam: focus,
      teams: sim.teams
        .map(publicTeam)
        .sort((a, b) => b.playoffPct - a.playoffPct || b.avgWins - a.avgWins),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ── Backtest on a finished season ─────────────────────────────────────── */

// Finished seasons only; defaults to the last five. ?year= scores one season.
router.get("/backtest", async (req, res) => {
  try {
    const last = getNFLSeasonYear() - 1;
    const year = Number(req.query.year) || null;
    const to = Math.min(last, year || Number(req.query.to) || last);
    const from = Math.max(2004, Math.min(to, year || Number(req.query.from) || to - 4));
    const iterations = Math.max(500, Math.min(10000, Number(req.query.iterations) || 1500));
    const data = await runBacktest({ from, to, iterations, checkpoints: DEFAULT_CHECKPOINTS });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ── Market futures validation ─────────────────────────────────────────── */

const DEVIG_METHODS = ["shin", "power", "proportional"];

router.get("/market-validation", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const iterations = Number(req.query.iterations) || undefined;
    // Shin by default; the others are exposed so the panel can show how much
    // the de-vig choice moves the board.
    const method = DEVIG_METHODS.includes(String(req.query.method))
      ? String(req.query.method)
      : "shin";
    // Omitted means "weight by how far into the season we are".
    const blendWeight = req.query.blendWeight === undefined
      ? undefined
      : Number(req.query.blendWeight);

    const data = await validateAgainstMarket({ year, iterations, method, blendWeight });
    res.json({ success: true, devigMethods: DEVIG_METHODS, ...data });
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
    _invalidateSimulationCache();
    res.json({ success: true, adjustment });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete("/adjustments/:team", requireAdmin, (req, res) => {
  const removed = removeAdjustments(req.params.team);
  _invalidateRatingsCache();
  _invalidateSimulationCache();
  res.json({ success: true, removed });
});

module.exports = router;
