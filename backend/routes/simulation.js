const express = require("express");
const router = express.Router();

const { generateEspnPrediction } = require("../prediction");

router.post("/run", async (req, res) => {
  try {
    const { modelType, scenario, iterations = 1000 } = req.body;

    let modifier = 0;

    if (scenario === "injury_qb") modifier -= 0.15;
    if (scenario === "easy_schedule") modifier += 0.1;
    if (scenario === "weather_snow") modifier -= 0.05;

    const base = await generateEspnPrediction({
      year: new Date().getFullYear(),
      modelType,
    });

    const adjustedProb = Math.max(
      0.15,
      Math.min(0.85, base.winProbabilityPerGame + modifier)
    );

    res.json({
      success: true,
      modelUsed: modelType,
      scenarioApplied: scenario,
      results: {
        winProbability: adjustedProb * 100,
        projectedRecord: `${Math.round(base.projectedWins)}-${
          17 - Math.round(base.projectedWins)
        }`,
        confidenceScore: Math.round(adjustedProb * 100),
        story:
          scenario === "injury_qb"
            ? "QB injury derails offensive efficiency."
            : scenario === "easy_schedule"
            ? "Soft opponents inflate win totals."
            : "Season follows statistical baseline.",
      },
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: "Simulation failed" });
  }
});

module.exports = router;
