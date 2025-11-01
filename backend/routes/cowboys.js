const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const PredictionEngine = require("../chance");

let predictionHistory = [];

async function fetchCowboysRecord() {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal");
  const data = await res.json();
  const summary = data.team.record?.items?.[0]?.summary || "0-0";
  const [wins, losses, ties = 0] = summary.split("-").map(Number);
  return { wins, losses, ties };
}

async function fetchCowboysStats() {
  const res = await fetch(
    "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/6/statistics"
  );
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
}

router.get("/current", async (_req, res) => {
  try {
    const [record, stats] = await Promise.all([fetchCowboysRecord(), fetchCowboysStats()]);
    const prediction = PredictionEngine.calculatePrediction(record, stats);
    res.json({
      season: { ...record, ...stats, year: new Date().getFullYear() },
      prediction,
    });
  } catch (err) {
    console.error("Error computing prediction:", err);
    res.status(500).json({ error: "Failed to compute prediction" });
  }
});

router.post("/generate", async (_req, res) => {
  try {
    const [record, stats] = await Promise.all([fetchCowboysRecord(), fetchCowboysStats()]);
    const prediction = PredictionEngine.calculatePrediction(record, stats);
    predictionHistory.unshift(prediction);
    if (predictionHistory.length > 10) predictionHistory.pop();
    res.json({ prediction });
  } catch (err) {
    console.error("Error generating prediction:", err);
    res.status(500).json({ error: "Failed to generate prediction" });
  }
});

router.get("/history", (_req, res) => res.json({ history: predictionHistory }));

module.exports = router;
