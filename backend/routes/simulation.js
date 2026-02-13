const express = require("express");
const router = express.Router();

const { generateEspnPrediction } = require("../prediction");
const { getNFLSeasonYear } = require("../services/espn");



router.post("/run", async (req, res) => {
  try {
    const {
      modelType = "RandomForest",
      scenario = null,
      iterations = 1000,
    } = req.body;

    // ---------------- scenario modifier ----------------
    let scenarioModifier = 0;
    if (scenario === "injury_qb") scenarioModifier = -0.18;
    if (scenario === "easy_schedule") scenarioModifier = 0.12;
    if (scenario === "weather_snow") scenarioModifier = -0.07;

    // ---------------- run simulation ----------------
    const base = await generateEspnPrediction({
      year: getNFLSeasonYear(),
      modelType,
      iterations,
      scenarioModifier,
    });

    // ---------------- FIX: DO NOT ROUND ----------------
    const projectedWins = Number(base.expectedWins.toFixed(1));
    const projectedLosses = Number((17 - base.expectedWins).toFixed(1));

    res.json({
      success: true,
      modelUsed: modelType,
      scenarioApplied: scenario,
      results: {
        winProbability: Number((base.playoffProbability * 100).toFixed(1)),
        projectedRecord: `${projectedWins}-${projectedLosses}`,
        confidenceScore: Math.round(base.playoffProbability * 100),
        story:
          scenario === "injury_qb"
            ? "A major quarterback injury sharply reduces offensive efficiency across remaining games."
            : scenario === "easy_schedule"
            ? "A favorable remaining schedule increases win probability and cushions close matchups."
            : scenario === "weather_snow"
            ? "Snow-heavy conditions increase variance and suppress passing efficiency."
            : "The season follows the ESPN-based statistical baseline.",
      },
      meta: {
        source: "ESPN",
        gamesRemaining: base.gamesRemaining,
        modelVersion: base.modelUsed,
        generatedAt: base.generatedAt,
      },
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({
      success: false,
      error: "Simulation failed",
    });
  }
});

const { modelType="RandomForest", scenario=null, iterations=1000, chaos=0 } = req.body;

const base = await generateEspnPrediction({
  year: getNFLSeasonYear(),
  modelType,
  iterations,
  scenarioModifier,
  chaos: Number(chaos) || 0,
});


module.exports = router;


