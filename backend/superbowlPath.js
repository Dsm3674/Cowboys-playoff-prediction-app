const express = require("express");
const router = express.Router();
const Team = require("./teams");
const Season = require("./seasons");
const Prediction = require("./predictions");

const { generateEspnPrediction } = require("./prediction");

/* ---------------------------------------------------
   POST /api/prediction/generate
   Generates a new prediction and saves it to DB
--------------------------------------------------- */
router.post("/generate", async (req, res) => {
  try {
    const { modelType = "RandomForest" } = req.body;

    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys not found" });
    }

    const season = await Season.getCurrentSeason(cowboys.team_id);
    if (!season) {
      return res.status(404).json({ error: "No season found" });
    }

    const result = await generateEspnPrediction({
      year: season.year,
      modelType,
    });

    const saved = await Prediction.create({
      seasonId: season.season_id,
      playoffProb: result.playoffProbability,
      divisionProb: Math.min(result.playoffProbability * 0.6, 0.9),
      conferenceProb: Math.min(result.playoffProbability * 0.35, 0.7),
      superbowlProb: Math.min(result.playoffProbability * 0.15, 0.4),
      confidenceScore: Math.round(result.playoffProbability * 100),
      factors: {
        model: result.modelUsed,
        perGameWinProbabilities: result.perGameWinProbabilities,
        expectedWins: result.expectedWins,
        source: "ESPN",
      },
      modelVersion: `espn-mc-${modelType.toLowerCase()}`,
    });

    res.json({
      success: true,
      prediction: {
        playoff_probability: saved.playoff_probability,
        division_probability: saved.division_probability,
        conference_probability: saved.conference_probability,
        superbowl_probability: saved.superbowl_probability,
        expected_wins: result.expectedWins,
        record: result.currentRecord,
        model_used: result.modelUsed,
      },
    });
  } catch (err) {
    console.error("Prediction error:", err);
    res.status(500).json({ error: "Prediction failed" });
  }
});


router.get("/history", async (req, res) => {
  try {
    const rows = await Prediction.getAll();
    res.json({ history: rows });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;
