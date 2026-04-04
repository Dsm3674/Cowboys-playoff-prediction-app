const express = require("express");
const router = express.Router();

const {
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  normalizeTeamAbbr,
  getNFLTeamList,
} = require("../services/espn");
const { computeTSI } = require("../tsi");
const { buildSeasonPaths, computeMustWinGames } = require("../seasonPath");

function parseYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year > 1900 ? year : undefined;
}

router.get("/", async (req, res) => {
  try {
    const teams = await getNFLTeamList();
    res.json({ success: true, teams });
  } catch (err) {
    console.error("Error loading NFL teams:", err);
    res.status(500).json({ success: false, error: "Unable to load NFL team list" });
  }
});

router.get("/:team/schedule", async (req, res) => {
  try {
    const team = normalizeTeamAbbr(req.params.team);
    const year = parseYear(req.query.year);
    const games = await fetchTeamGamesSeasonToDate(team, year);

    res.json({ success: true, team, year: year || new Date().getFullYear(), games });
  } catch (err) {
    console.error("Error fetching team schedule:", err);
    res.status(500).json({ success: false, error: "Failed to fetch team schedule" });
  }
});

router.get("/:team/record", async (req, res) => {
  try {
    const team = normalizeTeamAbbr(req.params.team);
    const year = parseYear(req.query.year);
    const games = await fetchTeamGamesSeasonToDate(team, year);

    if (!games || games.length === 0) {
      return res.json({ success: true, team, year: year || new Date().getFullYear(), wins: 0, losses: 0, ties: 0 });
    }

    const record = computeRecordFromGames(games, team);
    res.json({ success: true, team, year: year || new Date().getFullYear(), ...record });
  } catch (err) {
    console.error("Error computing team record:", err);
    res.status(500).json({ success: false, error: "Failed to compute team record" });
  }
});

router.get("/:team/tsi", async (req, res) => {
  try {
    const team = normalizeTeamAbbr(req.params.team);
    const year = parseYear(req.query.year);
    const data = await computeTSI({ teamAbbr: team, year });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Error computing team TSI:", err);
    res.status(500).json({ success: false, error: "Failed to compute team TSI" });
  }
});

router.get("/:team/paths", async (req, res) => {
  try {
    const team = normalizeTeamAbbr(req.params.team);
    const year = parseYear(req.query.year);
    const k = Math.min(60, Math.max(5, Number(req.query.k) || 25));
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));
    const iterations = Number(req.query.iterations) || undefined;

    const data = await buildSeasonPaths({ teamAbbr: team, year, chaos, iterations });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Error building team season paths:", err);
    res.status(500).json({ success: false, error: "Failed to build season paths" });
  }
});

router.get("/:team/mustwin", async (req, res) => {
  try {
    const team = normalizeTeamAbbr(req.params.team);
    const year = parseYear(req.query.year);
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));
    const iterations = Number(req.query.iterations) || undefined;

    const games = await computeMustWinGames({ teamAbbr: team, year, chaos, iterations });
    res.json({ success: true, team, year: year || new Date().getFullYear(), games });
  } catch (err) {
    console.error("Error computing must-win games:", err);
    res.status(500).json({ success: false, error: "Failed to compute must-win games" });
  }
});

module.exports = router;
