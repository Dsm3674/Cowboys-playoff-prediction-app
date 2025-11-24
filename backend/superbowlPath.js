
const express = require('express');
const router = express.Router();
const Team = require('./teams');
const Season = require('./seasons');
const Prediction = require('./predictions');
const PredictionEngine = require('./chance');
const pool = require('./databases');

// GET /api/prediction/current
router.get('/current', async (req, res) => {
  try {
    const cowboys = await Team.findByName('Dallas Cowboys');
    if (!cowboys) return res.status(404).json({ error: 'Cowboys team not found' });

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({
        error: 'No current season data',
        message: 'Database needs season data'
      });
    }

    // DB prediction record
    const latestPrediction = await Prediction.getLatest(currentSeason.season_id);

    // FIX: Ensure fields match frontend expectations
    const normalizedPrediction = latestPrediction
      ? {
          playoff_probability: latestPrediction.playoff_probability,
          division_probability: latestPrediction.division_probability,
          conference_probability: latestPrediction.conference_probability,
          superbowl_probability: latestPrediction.superbowl_probability,
          confidence_score: latestPrediction.confidence_score,
          generated_at: latestPrediction.prediction_date
        }
      : {
          playoff_probability: 0,
          division_probability: 0,
          conference_probability: 0,
          superbowl_probability: 0,
          confidence_score: 70
        };

    // Players
    const playersResult = await pool.query(
      'SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC',
      [currentSeason.season_id]
    );

    // Game stats
    const gameStatsResult = await pool.query(
      'SELECT * FROM game_stats WHERE season_id = $1 ORDER BY week',
      [currentSeason.season_id]
    );

    res.json({
      team: cowboys.team_name,
      season: currentSeason,
      prediction: normalizedPrediction,
      players: playersResult.rows,
      gameStats: gameStatsResult.rows
    });
  } catch (error) {
    console.error('Error fetching current prediction:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// POST /api/prediction/generate
router.post('/generate', async (req, res) => {
  try {
    const cowboys = await Team.findByName('Dallas Cowboys');
    if (!cowboys) return res.status(404).json({ error: 'Cowboys not found' });

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ error: 'No season data' });
    }

    const seasonStats = await Season.getSeasonStats(currentSeason.season_id);
    if (!seasonStats || !seasonStats.games_played) {
      return res.status(400).json({ error: 'Insufficient data to generate prediction' });
    }

    const prediction = PredictionEngine.calculatePrediction(currentSeason, seasonStats);

    // Save to DB using correct fields
    const savedPrediction = await Prediction.create({
      seasonId: currentSeason.season_id,
      playoffProb: prediction.playoffs,
      divisionProb: prediction.division,
      conferenceProb: prediction.conference,
      superbowlProb: prediction.superBowl,
      confidenceScore: 75,
      factors: { teamStrength: 'calculated' },
      modelVersion: 'v2.1'
    });

    res.json({
      success: true,
      prediction: {
        playoff_probability: savedPrediction.playoff_probability,
        division_probability: savedPrediction.division_probability,
        conference_probability: savedPrediction.conference_probability,
        superbowl_probability: savedPrediction.superbowl_probability,
        confidence_score: savedPrediction.confidence_score
      }
    });
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// GET /api/prediction/history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    const cowboys = await Team.findByName('Dallas Cowboys');
    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);

    const history = await Prediction.getHistory(currentSeason.season_id, limit);

    // Normalize all entries
    const formatted = history.map(p => ({
      playoff_probability: p.playoff_probability,
      division_probability: p.division_probability,
      conference_probability: p.conference_probability,
      superbowl_probability: p.superbowl_probability,
      confidence_score: p.confidence_score,
      prediction_date: p.prediction_date
    }));

    res.json({ history: formatted });
  } catch (error) {
    console.error('Error fetching prediction history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
