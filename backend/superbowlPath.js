const express = require("express");
const router = express.Router();
const Team = require("./teams");
const Season = require("./seasons");
const Prediction = require("./predictions");
const PredictionEngine = require("./chance");
const pool = require("./databases");



router.get("/current", async (req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) return res.status(404).json({ error: "Cowboys team not found" });

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason)
      return res.status(404).json({ error: "No current season data" });

    const latestPrediction = await Prediction.getLatest(
      currentSeason.season_id
    );

    const normalizedPrediction = latestPrediction
      ? {
          playoff_probability: latestPrediction.playoff_probability,
          division_probability: latestPrediction.division_probability,
          conference_probability: latestPrediction.conference_probability,
          superbowl_probability: latestPrediction.superbowl_probability,
          confidence_score: latestPrediction.confidence_score,
          generated_at: latestPrediction.prediction_date,
        }
      : {
          playoff_probability: 0,
          division_probability: 0,
          conference_probability: 0,
          superbowl_probability: 0,
          confidence_score: 70,
        };

    res.json({
      team: cowboys.team_name,
      season: currentSeason,
      prediction: normalizedPrediction,
    });
  } catch (error) {
    console.error("Error fetching current prediction:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- GENERATE PREDICTION ---------------- */

router.post("/generate", async (req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) return res.status(404).json({ error: "Cowboys not found" });

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason)
      return res.status(404).json({ error: "No season data" });

    const seasonStats = await Season.getSeasonStats(
      currentSeason.season_id
    );
    if (!seasonStats || !seasonStats.games_played) {
      return res.status(400).json({ error: "Insufficient data" });
    }

    const record = {
      wins: Number(currentSeason.wins ?? 0),
      losses: Number(currentSeason.losses ?? 0),
      ties: Number(currentSeason.ties ?? 0),
    };

    const prediction = PredictionEngine.calculatePrediction(
      record,
      seasonStats
    );

    const saved = await Prediction.create({
      seasonId: currentSeason.season_id,
      playoffProb: prediction.playoffs,
      divisionProb: prediction.division,
      conferenceProb: prediction.conference,
      superbowlProb: prediction.superBowl,
      confidenceScore: 75,
      factors: { teamStrength: "calculated" },
      modelVersion: "v2.1",
    });

    res.json({
      success: true,
      prediction: {
        playoff_probability: saved.playoff_probability,
        division_probability: saved.division_probability,
        conference_probability: saved.conference_probability,
        superbowl_probability: saved.superbowl_probability,
        confidence_score: saved.confidence_score,
      },
    });
  } catch (error) {
    console.error("Error generating prediction:", error);
    res.status(500).json({ error: "Server error" });
  }
});



router.get("/history", async (req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) return res.json({ history: [] });

    const season = await Season.getCurrentSeason(cowboys.team_id);
    if (!season) return res.json({ history: [] });

    const history = await Prediction.getHistory(season.season_id);
    res.json({ history });
  } catch (err) {
    console.error("Error fetching prediction history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;

