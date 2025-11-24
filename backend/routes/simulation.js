const express = require('express');
const router = express.Router();


router.post('/run', async (req, res) => {
  try {
    const { modelType, scenario, iterations = 100 } = req.body;

    // Base probabilities (would normally come from DB history)
    let winProbability = 0.62; 
    let confidence = 75.0;
    let projectedWins = 10;
    let projectedLosses = 7;
    let storyLine = "Season proceeds as expected based on current roster.";

    // Feature 9: Model Switching Logic
    if (modelType === 'LSTM') {
        // LSTM typically needs more data, might be more volatile
        confidence = 65.0; 
        storyLine = "Deep learning model detects slight regression in offensive line play.";
    } else if (modelType === 'Elo') {
        // Elo is conservative
        winProbability = 0.58;
        projectedWins = 9;
        projectedLosses = 8;
        storyLine = "Elo rating adjustment suggests a tougher schedule ahead.";
    } else if (modelType === 'RandomForest') {
        // Standard ML
        confidence = 82.0;
    }

    
    if (scenario) {
        if (scenario === 'injury_qb') {
            winProbability -= 0.20;
            projectedWins -= 3;
            projectedLosses += 3;
            storyLine = "BREAKING: Major QB injury significantly impacts playoff odds."; // Feature 7
        } else if (scenario === 'easy_schedule') {
            winProbability += 0.10;
            projectedWins += 2;
            projectedLosses -= 2;
        } else if (scenario === 'weather_snow') {
            winProbability -= 0.05; // Cowboys play in a dome, but away games matter
            storyLine = "Late season blizzard games in Philly and NY affect passing game.";
        }
    }

  
    let simWins = 0;
    for(let i=0; i<iterations; i++) {
        // Simple weighted random check
        if(Math.random() < winProbability) simWins++;
    }
    const simulatedWinPct = (simWins / iterations) * 100;

    res.json({
        success: true,
        modelUsed: modelType,
        scenarioApplied: scenario,
        results: {
            winProbability: simulatedWinPct.toFixed(1),
            confidenceScore: confidence,
            projectedRecord: `${projectedWins}-${projectedLosses}`,
            story: storyLine
        }
    });

  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

module.exports = router;
