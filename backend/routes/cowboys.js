const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

/**
 * 🏈 1. Real-time Cowboys record from ESPN
 */
router.get("/record", async (req, res) => {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal"
    );
    const data = await response.json();

    const recordStr = data?.team?.record?.items?.[0]?.summary || "0-0";
    const parts = recordStr.split("-").map(Number);

    const wins = parts[0] || 0;
    const losses = parts[1] || 0;
    const ties = parts[2] || 0;

    res.json({
      team: "Dallas Cowboys",
      wins,
      losses,
      ties,
      source: "ESPN",
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error fetching live record:", err);
    res.status(500).json({
      error: "Failed to fetch live record",
      fallback: { team: "Dallas Cowboys", wins: 0, losses: 0, ties: 0 },
    });
  }
});

/**
 * 🧮 2. Real playoff odds (FiveThirtyEight)
 */
router.get("/current", async (req, res) => {
  try {
    const response = await fetch("https://projects.fivethirtyeight.com/nfl-api/nfl_elo_latest.json");
    const data = await response.json();

    // Find Dallas Cowboys entry
    const cowboys = data.find(
      (team) => team.team_code === "DAL" || team.team === "Cowboys"
    );

    if (!cowboys) throw new Error("Cowboys not found in FiveThirtyEight data");

    res.json({
      playoff_probability: (cowboys.playoff_prob * 100).toFixed(1),
      division_probability: (cowboys.division_prob * 100).toFixed(1),
      conference_probability: (cowboys.sb_prob * 100).toFixed(1),
      superbowl_probability: (cowboys.sb_win_prob * 100).toFixed(1),
      confidence_score: ((cowboys.elo / 1700) * 100).toFixed(1),
      season: {
        wins: cowboys.wins,
        losses: cowboys.losses,
        ties: cowboys.ties || 0,
        year: new Date().getFullYear(),
      },
    });
  } catch (err) {
    console.error("Error fetching real playoff odds:", err);
    res.status(500).json({
      error: "Failed to fetch FiveThirtyEight data",
      fallback: {
        playoff_probability: 72.5,
        division_probability: 45.3,
        conference_probability: 18.7,
        superbowl_probability: 8.2,
        confidence_score: 84.5,
      },
    });
  }
});

/**
 * 🌀 3. Generate random prediction (for fun/testing)
 */
router.post("/generate", async (req, res) => {
  const newPrediction = {
    playoff_probability: parseFloat((Math.random() * 100).toFixed(1)),
    division_probability: parseFloat((Math.random() * 80).toFixed(1)),
    conference_probability: parseFloat((Math.random() * 60).toFixed(1)),
    superbowl_probability: parseFloat((Math.random() * 30).toFixed(1)),
    confidence_score: parseFloat((70 + Math.random() * 30).toFixed(1)),
  };
  res.json({ prediction: newPrediction });
});

/**
 * 📜 4. Basic history (static for now)
 */
router.get("/history", (req, res) => {
  res.json({
    history: [
      {
        prediction_date: new Date().toISOString(),
        playoff_probability: 70.1,
        division_probability: 43.2,
        conference_probability: 17.4,
        superbowl_probability: 7.5,
      },
    ],
  });
});

module.exports = router;
