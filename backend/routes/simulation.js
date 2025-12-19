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

    // ----- scenario modifier (applied AFTER ESPN model baseline) -----
    let modifier = 0;
    if (scenario === "injury_qb") modifier -= 0.15;
    if (scenario === "easy_schedule") modifier += 0.10;
    if (scenario === "weather_snow") modifier -= 0.05;

    // ----- generate baseline ESPN-based prediction -----
    const base = await generateEspnPrediction({
      year: getNFLSeasonYear(),
      modelType,
    });

    // use average per-game win probability from ESPN model
    const adjustedWinProb = Math.max(
      0.15,
      Math.min(0.85, base.winProbabilityPerGameAvg + modifier)
    );

    // projected record string (simple display helper)
    const projectedWins = Math.round(base.projectedWins);
    const projectedLosses = 17 - projectedWins;

    res.json({
      success: true,
      modelUsed: modelType,
      scenarioApplied: scenario,
      results: {
        winProbability: adjustedWinProb * 100,
        projectedRecord: `${projectedWins}-${projectedLosses}`,
        confidenceScore: Math.round(adjustedWinProb * 100),
        story:
          scenario === "injury_qb"
            ? "A major quarterback injury sharply reduces offensive efficiency and late-game execution."
            : scenario === "easy_schedule"
            ? "A softer remaining schedule boosts win probability and cushions close matchups."
            : scenario === "weather_snow"
            ? "Snow and adverse weather increase variance, hurting passing efficiency."
            : "The season follows the statistical baseline derived from ESPN data.",
      },
      meta: {
        source: "ESPN",
        gamesRemaining: base.gamesRemaining,
        baselineWinProb: Number(
          (base.winProbabilityPerGameAvg * 100).toFixed(1)
        ),
        scenarioModifier: modifier,
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

module.exports = router;

