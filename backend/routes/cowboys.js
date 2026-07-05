const express = require("express"); 
const router = express.Router();
const { fetchTeamGamesSeasonToDate, computeRecordFromGames } = require("../services/espn");

// GET /api/cowboys/schedule
router.get("/schedule", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const team = String(req.query.team || "DAL").toUpperCase();
    const games = await fetchTeamGamesSeasonToDate(team, year);
    res.json({ year, team, games });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

// GET /api/cowboys/record
router.get("/record", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const team = String(req.query.team || "DAL").toUpperCase();
    const games = await fetchTeamGamesSeasonToDate(team, year);

    if (!games || games.length === 0) {
      return res.json({ wins: 0, losses: 0, ties: 0 });
    }

    const record = computeRecordFromGames(games, team);
    res.json(record);
  } catch (err) {
    console.error("Error computing record:", err);
    res.status(500).json({ error: "Failed to compute record" });
  }
});

module.exports = router;

