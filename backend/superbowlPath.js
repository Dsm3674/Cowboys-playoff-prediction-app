const express = require('express');
const router = express.Router();
const Team = require('./teams');
const Season = require('./seasons');
const Prediction = require('./prediction');
const PredictionEngine = require('./chance');
const pool = require('./databases');

// GET /api/predictions/current - Get current season data and latest prediction
router.get('/current', async (req, res) => {
  try {
    const cowboys = await Team.findByName('Dallas Cowboys');
    if (!cowboys) {
      return res.status(404).json({ error: 'Cowboys team not found in database' });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ 
        error: 'No current season data',
        message: 'Please ensure the database has been seeded with season data'
      });
    }

    const latestPrediction = await Prediction.getLatest(currentSeason.season_id);
    
    const playersQuery = 'SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC';
    const playersResult = await pool.query(playersQuery, [currentSeason.season_id]);
    
    const gameStatsQuery = 'SELECT * FROM game_stats WHERE season_id = $1 ORDER BY week';
    const gameStatsResult = await pool.query(gameStatsQuery, [currentSeason.season_id]);
    
    res.json({
      team: cowboys.team_name,
      season: currentSeason,
      prediction: latestPrediction || null,
      players: playersResult.rows,
      gameStats: gameStatsResult.rows
    });
  } catch (error) {
    console.error('Error fetching current prediction:', error);
    
    // Handle specific error types
    if (error.code === '42P01') { // undefined_table
      return res.status(500).json({ 
        error: 'Database tables not initialized',
        message: 'Please run the schema.sql and seed.sql scripts to set up the database'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// POST /api/predictions/generate - Generate new prediction
router.post('/generate', async (req, res) => {
  try {
    const cowboys = await Team.findByName('Dallas Cowboys');
    if (!cowboys) {
      return res.status(404).json({ error: 'Cowboys team not found in database' });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ 
        error: 'No current season data',
        message: 'Cannot generate prediction without season data'
      });
    }

    const seasonStats = await Season.getSeasonStats(currentSeason.season_id);
    
    // Validate season stats
    if (!seasonStats || !seasonStats.games_played || seasonStats.games_played === '0') {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'Cannot generate prediction without game statistics'
      });
    }
    
    const playersQuery = 'SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC';
    const playersResult = await pool.query(playersQuery, [currentSeason.season_id]);
    
    const prediction = PredictionEngine.calculatePrediction(
      currentSeason,
      seasonStats,
      playersResult.rows
    );
    
    const savedPrediction = await Prediction.create({
      seasonId: currentSeason.season_id,
      playoffProb: prediction.playoffProb,
      divisionProb: prediction.divisionProb,
      conferenceProb: prediction.conferenceProb,
      superbowlProb: prediction.superbowlProb,
      confidenceScore: prediction.confidenceScore,
      factors: prediction.factors,
      modelVersion: 'v2.1'
    });
    
    res.json({
      success: true,
      prediction: savedPrediction
    });
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ 
      error: 'Failed to generate prediction', 
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET /api/predictions/history - Get prediction history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Validate limit
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 100'
      });
    }

    const cowboys = await Team.findByName('Dallas Cowboys');
    if (!cowboys) {
      return res.status(404).json({ error: 'Cowboys team not found in database' });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ error: 'No current season data' });
    }

    const history = await Prediction.getHistory(currentSeason.season_id, limit);
    res.json({ history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prediction history', 
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;