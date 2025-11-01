// -------------------------
// COWBOYS ROUTES (CommonJS version)
// -------------------------
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

// In-memory store (temporary, resets when server restarts)
let predictionHistory = [];

/**
 * GET /api/cowboys/record
 * Returns the current season record (wins, losses, ties) from ESPN API
 */
router.get("/record", async (req, res) => {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal"
    );
    const data = await response.json();

    // Extract record summary (e.g. "3-4" or "3-4-1")
    const summary = data.team.record?.items?.[0]?.summary || "0-0";
    const [wins, losses, ties = 0] = summary.split("-").map(Number);

    return res.json({ wins, losses, ties });
  } catch (error) {
    console.error("❌ Error fetching Cowboys record:", error);
    return res.status(500).json({ wins: 0, losses: 0, ties: 0 });
  }
});

/**
 * GET /api/cowboys/current
 * Returns current season info + a generated prediction
 */
router.get("/current", async (req, res) => {
  try {
    const recordRes = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal"
    );
    const recordData = await recordRes.json();
    const summary = recordData.team.record?.items?.[0]?.summary || "0-0";
    const [wins, losses, ties = 0] = summary.split("-").map(Number);

    const totalGames = wins + losses + ties;
    const winPct = totalGames > 0 ? wins / totalGames : 0;

    // Very simple predictive model
    const playoffProbability = Math.round(winPct * 100);
    const divisionProbability = Math.round(playoffProbability * 0.7);
    const conferenceProbability = Math.round(playoffProbability * 0.4);
    const superbowlProbability = Math.round(playoffProbability * 0.2);
    const confidenceScore = Math.round(50 + winPct * 50);

    const prediction = {
      playoff_probability: playoffProbability,
      division_probability: divisionProbability,
      conference_probability: conferenceProbability,
      superbowl_probability: superbowlProbability,
      confidence_score: confidenceScore,
    };

    const season = { wins, losses, ties, year: new Date().getFullYear() };

    res.json({ season, prediction });
  } catch (error) {
    console.error("❌ Error in /current:", error);
    res.status(500).json({
      season: { wins: 0, losses: 0, ties: 0 },
      prediction: {
        playoff_probability: 0,
        division_probability: 0,
        conference_probability: 0,
        superbowl_probability: 0,
        confidence_score: 0,
      },
    });
  }
});

/**
 * POST /api/cowboys/generate
 * Generates a new prediction and stores it in memory
 */
router.post("/generate", async (req, res) => {
  try {
    const playoff_probability = Math.round(Math.random() * 100);
    const division_probability = Math.round(playoff_probability * 0.7);
    const conference_probability = Math.round(playoff_probability * 0.4);
    const superbowl_probability = Math.round(playoff_probability * 0.2);
    const confidence_score = Math.round(60 + Math.random() * 40);

    const prediction = {
      playoff_probability,
      division_probability,
      conference_probability,
      superbowl_probability,
      confidence_score,
      prediction_date: new Date().toISOString(),
    };

    predictionHistory.unshift(prediction);
    if (predictionHistory.length > 10) predictionHistory.pop();

    res.json({ prediction });
  } catch (error) {
    console.error("❌ Error generating prediction:", error);
    res.status(500).json({ message: "Failed to generate prediction" });
  }
});

/**
 * GET /api/cowboys/history
 * Returns up to 10 most recent generated predictions
 */
router.get("/history", (req, res) => {
  res.json({ history: predictionHistory });
});

module.exports = router;
