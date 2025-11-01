const express = require("express");
const router = express.Router();
const { fetchCowboysGamesSeasonToDate, computeRecordFromGames } = require("../services/espn");

// GET /api/cowboys/schedule
router.get("/schedule", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);
    res.json({ year, games });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

// GET /api/cowboys/record
router.get("/record", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);

    if (!games || games.length === 0) {
      return res.json({ wins: 0, losses: 0, ties: 0 });
    }

    const record = computeRecordFromGames(games);
    res.json(record);
  } catch (err) {
    console.error("Error computing record:", err);
    res.status(500).json({ error: "Failed to compute record" });
  }
});

module.exports = router;

