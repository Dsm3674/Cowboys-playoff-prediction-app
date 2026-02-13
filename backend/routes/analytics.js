
const express = require("express");
const router = express.Router();

const { computeWinProbability } = require("../winprob");
const { computeTSI } = require("../tsi");
const { buildSeasonPaths, computeMustWinGames } = require("../seasonPath");


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

module.exports = router;
