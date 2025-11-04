const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const PredictionEngine = require("./chance");

let predictionHistory = [];

// ✅ Fetch Cowboys record from your own live API (accurate week-to-week)
async function fetchCowboysRecord() {
  try {
    const res = await fetch(
      "https://cowboys-playoff-prediction-app.onrender.com/api/cowboys/record"
    );
    if (!res.ok) throw new Error("record fetch failed");
    const data = await res.json();
    return data; // { wins, losses, ties, winPct, text }
  } catch (err) {
    console.error("Error fetching Cowboys record:", err.message);
    return { wins: 0, losses: 0, ties: 0 };
  }
}

// ✅ Fetch live stats from ESPN (still fine to use directly)
async function fetchCowboysStats() {
  try {
    const res = await fetch(
      "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/6/statistics"
    );
    if (!res.ok) throw new Error("stats fetch failed");
    const data = await res.json();
    const categories = data.splits?.categories || [];

    let pointsPerGame = 0,
      yardsPerGame = 0,
      pointsAllowed = 0,
      turnovers = 1.5;

    for (const cat of categories) {
      for (const stat of cat.stats || []) {
        if (stat.name === "pointsPerGame") pointsPerGame = stat.value;
        if (stat.name === "yardsPerGame") yardsPerGame = stat.value;
        if (stat.name === "pointsAllowedPerGame") pointsAllowed = stat.value;
        if (stat.name === "turnovers") turnovers = stat.value;
      }
    }

    return {
      avg_points_scored: pointsPerGame || 0,
      avg_total_yards: yardsPerGame || 0,
      avg_points_allowed: pointsAllowed || 0,
      avg_turnovers: turnovers || 1.5,
    };
  } catch (err) {
    console.error("Error fetching Cowboys stats:", err.message);
    return {
      avg_points_scored: 0,
      avg_total_yards: 0,
      avg_points_allowed: 0,
      avg_turnovers: 1.5,
    };
  }
}

// ✅ Get combined prediction (record + stats)
router.get("/current", async (_req, res) => {
  try {
    const [record, stats] = await Promise.all([
      fetchCowboysRecord(),
      fetchCowboysStats(),
    ]);

    const prediction = PredictionEngine.calculatePrediction(record, stats);
    prediction.generatedAt = new Date().toISOString();

    console.log(
      `📈 Prediction generated — Record: ${record.wins}-${record.losses}-${record.ties}, Playoff: ${(prediction.playoffs * 100).toFixed(1)}%`
    );

    res.json({
      season: { ...record, ...stats, year: new Date().getFullYear() },
      prediction,
    });
  } catch (err) {
    console.error("Error computing prediction:", err);
    res.status(500).json({ error: "Failed to compute prediction" });
  }
});

// ✅ Generate new prediction and save to short-term memory
router.post("/generate", async (_req, res) => {
  try {
    const [record, stats] = await Promise.all([
      fetchCowboysRecord(),
      fetchCowboysStats(),
    ]);

    const prediction = PredictionEngine.calculatePrediction(record, stats);
    prediction.generatedAt = new Date().toISOString();
    predictionHistory.unshift(prediction);
    if (predictionHistory.length > 10) predictionHistory.pop();

    res.json({ prediction });
  } catch (err) {
    console.error("Error generating prediction:", err);
    res.status(500).json({ error: "Failed to generate prediction" });
  }
});

// ✅ Retrieve short-term prediction history
router.get("/history", (_req, res) => res.json({ history: predictionHistory }));

module.exports = router;
