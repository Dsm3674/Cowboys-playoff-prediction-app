// -------------------------
// COWBOYS ROUTES (Hybrid: Live Data + ML Model)
// -------------------------
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const PredictionEngine = require("../chance");

let predictionHistory = [];

/** ESPN: record */
async function fetchCowboysRecord() {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal");
  const data = await res.json();
  const summary = data.team.record?.items?.[0]?.summary || "0-0";
  const [wins, losses, ties = 0] = summary.split("-").map(Number);
  return { wins, losses, ties };
}

/** ESPN: advanced stats */
async function fetchCowboysStats() {
  try {
    const res = await fetch(
      "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/6/statistics"
    );
    const data = await res.json();
    const categories = data.splits?.categories || [];
    let pointsPerGame = 0,
      yardsPerGame = 0,
      pointsAllowedPerGame = 0,
      yardsAllowedPerGame = 0;

    for (const cat of categories) {
      for (const stat of cat.stats || []) {
        if (stat.name === "pointsPerGame") pointsPerGame = stat.value;
        if (stat.name === "yardsPerGame") yardsPerGame = stat.value;
        if (stat.name === "pointsAllowedPerGame") pointsAllowedPerGame = stat.value;
        if (stat.name === "yardsAllowedPerGame") yardsAllowedPerGame = stat.value;
      }
    }

    return {
      avg_points_scored: pointsPerGame,
      avg_total_yards: yardsPerGame,
      avg_points_allowed: pointsAllowedPerGame,
      avg_turnovers: 1.2, // approximate, API doesn’t expose turnovers directly
    };
  } catch (err) {
    console.error("Error fetching ESPN stats:", err);
    return { avg_points_scored: 0, avg_total_yards: 0, avg_points_allowed: 0, avg_turnovers: 0 };
  }
}

/** FiveThirtyEight: playoff odds + ELO */
async function fetchCowboysOdds() {
  const res = await fetch("https://projects.fivethirtyeight.com/nfl-api/nfl_elo_latest.json");
  const data = await res.json();
  const cowboys = data.find((t) => t.team_abbr === "DAL");
  if (!cowboys) throw new Error("Cowboys data not found");

  const playoff_probability = Math.round(cowboys.playoff_odds * 100);
  const division_probability = Math.round(cowboys.division_odds * 100);
  const conference_probability = Math.round(cowboys.conf_odds * 100);
  const superbowl_probability = Math.round(cowboys.sb_odds * 100);
  const confidence_score = Math.min(100, Math.max(0, Math.round((cowboys.elo - 1400) / 3)));

  return {
    playoff_probability,
    division_probability,
    conference_probability,
    superbowl_probability,
    confidence_score,
    elo: cowboys.elo,
  };
}

/** GET /api/cowboys/current */
router.get("/current", async (_req, res) => {
  try {
    const [record, stats, odds] = await Promise.all([
      fetchCowboysRecord(),
      fetchCowboysStats(),
      fetchCowboysOdds(),
    ]);

    // 🧠 Use your ML model to make its own prediction
    const mlPrediction = PredictionEngine.calculatePrediction(
      { wins: record.wins, losses: record.losses },
      stats,
      [] // players not included in ESPN response
    );

    res.json({
      season: { ...record, year: new Date().getFullYear(), factors_json: stats },
      prediction: {
        // FiveThirtyEight’s actual model
        from_538: {
          playoff_probability: odds.playoff_probability,
          division_probability: odds.division_probability,
          conference_probability: odds.conference_probability,
          superbowl_probability: odds.superbowl_probability,
          confidence_score: odds.confidence_score,
          elo: odds.elo,
        },
        // Your ML model’s output
        from_model: mlPrediction,
      },
    });
  } catch (err) {
    console.error("Error /current:", err);
    res.status(500).json({
      error: "Failed to fetch current data",
    });
  }
});

/** POST /api/cowboys/generate — refresh ML prediction */
router.post("/generate", async (_req, res) => {
  try {
    const [record, stats] = await Promise.all([
      fetchCowboysRecord(),
      fetchCowboysStats(),
    ]);

    const mlPrediction = PredictionEngine.calculatePrediction(
      { wins: record.wins, losses: record.losses },
      stats,
      []
    );

    mlPrediction.prediction_date = new Date().toISOString();
    predictionHistory.unshift(mlPrediction);
    if (predictionHistory.length > 10) predictionHistory.pop();

    res.json({ prediction: mlPrediction });
  } catch (err) {
    console.error("Error generating ML prediction:", err);
    res.status(500).json({ message: "Failed to generate ML prediction" });
  }
});

/** GET /api/cowboys/history */
router.get("/history", (_req, res) => {
  res.json({ history: predictionHistory });
});

module.exports = router;

