const express = require("express");
const router = express.Router();
const Team = require("./teams");
const Season = require("./seasons");
const Prediction = require("./predictions");

const { generateEspnPrediction } = require("./prediction");
const { simulationLimiter } = require("./middleware/RateLimiter");

function serializePrediction(row, extra = {}) {
  if (!row) return null;

  let factors = row.factors_json || {};
  if (typeof factors === "string") {
    try {
      factors = JSON.parse(factors);
    } catch (_err) {
      factors = {};
    }
  }

  return {
    id: row.prediction_id,
    season_id: row.season_id,
    prediction_date: row.prediction_date,
    playoff_probability: row.playoff_probability,
    division_probability: row.division_probability,
    conference_probability: row.conference_probability,
    superbowl_probability: row.superbowl_probability,
    confidence_score: row.confidence_score,
    expected_wins: factors.expectedWins ?? factors.expected_wins ?? extra.expected_wins ?? null,
    record: extra.record ?? null,
    model_used: factors.model ?? row.model_version,
    model_version: row.model_version,
    factors,
  };
}

/* ---------------------------------------------------
   POST /api/prediction/generate
   Generates a new prediction and saves it to DB
--------------------------------------------------- */
router.post("/generate", simulationLimiter, async (req, res) => {
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

router.get("/current", async (_req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys not found" });
    }

    const season = await Season.getCurrentSeason(cowboys.team_id);
    if (!season) {
      return res.status(404).json({ error: "No season found" });
    }

    const latest = await Prediction.getLatest(season.season_id);
    if (!latest) {
      return res.status(404).json({ error: "No cached prediction found" });
    }

    res.json({
      success: true,
      season,
      prediction: serializePrediction(latest),
    });
  } catch (err) {
    console.error("Current prediction fetch error:", err);
    res.status(500).json({ error: "Failed to load current prediction" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const rows = await Prediction.getAll(limit);
    res.json({ history: rows.map((row) => serializePrediction(row)) });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;
