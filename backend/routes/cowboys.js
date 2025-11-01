// -------------------------
// COWBOYS ROUTES (REAL DATA VERSION)
// -------------------------
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

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

    const offensive_rating = ((pointsPerGame + yardsPerGame / 100) / 10).toFixed(1);
    const defensive_rating = (100 - (pointsAllowedPerGame + yardsAllowedPerGame / 100) / 10).toFixed(1);
    return { offensive_rating: Number(offensive_rating), defensive_rating: Number(defensive_rating) };
  } catch (err) {
    console.error("Error fetching ESPN stats:", err);
    return { offensive_rating: 0, defensive_rating: 0 };
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

  // Confidence score derived from ELO (1400-1700 -> 0-100)
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

/** GET /api/cowboys/record */
router.get("/record", async (_req, res) => {
  try {
    res.json(await fetchCowboysRecord());
  } catch (err) {
    console.error("Error fetching record:", err);
    res.status(500).json({ wins: 0, losses: 0, ties: 0 });
  }
});

/** GET /api/cowboys/current */
router.get("/current", async (_req, res) => {
  try {
    const [record, stats, odds] = await Promise.all([
      fetchCowboysRecord(),
      fetchCowboysStats(),
      fetchCowboysOdds(),
    ]);

    const season = {
      ...record,
      year: new Date().getFullYear(),
      factors_json: stats,
    };

    const prediction = {
      playoff_probability: odds.playoff_probability,
      division_probability: odds.division_probability,
      conference_probability: odds.conference_probability,
      superbowl_probability: odds.superbowl_probability,
      confidence_score: odds.confidence_score,
    };

    res.json({ season, prediction });
  } catch (err) {
    console.error("Error /current:", err);
    res.status(500).json({
      season: { wins: 0, losses: 0, ties: 0, factors_json: { offensive_rating: 0, defensive_rating: 0 } },
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

/** POST /api/cowboys/generate — now re-fetches live odds, not random */
router.post("/generate", async (_req, res) => {
  try {
    const odds = await fetchCowboysOdds();
    const prediction = {
      playoff_probability: odds.playoff_probability,
      division_probability: odds.division_probability,
      conference_probability: odds.conference_probability,
      superbowl_probability: odds.superbowl_probability,
      confidence_score: odds.confidence_score,
      prediction_date: new Date().toISOString(),
    };
    predictionHistory.unshift(prediction);
    if (predictionHistory.length > 10) predictionHistory.pop();
    res.json({ prediction });
  } catch (err) {
    console.error("Error generating live prediction:", err);
    res.status(500).json({ message: "Failed to fetch real prediction data" });
  }
});

/** GET /api/cowboys/history */
router.get("/history", (_req, res) => {
  res.json({ history: predictionHistory });
});

module.exports = router;
