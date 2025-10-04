const express = require('express');
const router = express.Router();
const Team = require('./teams');
const Season = require('./seasons');

// GET /api/teams/:teamId/seasons - Get team's season history
router.get('/:teamId/seasons', async (req, res) => {
  try {
    const { teamId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate teamId
    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({ 
        error: 'Invalid team ID',
        message: 'Team ID must be a valid number'
      });
    }
    
    // Validate limit
    if (limit < 1 || limit > 50) {
      return res.status(400).json({ 
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 50'
      });
    }
    
    const seasons = await Season.getSeasonHistory(teamId, limit);
    res.json({ seasons });
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ 
      error: 'Failed to fetch team seasons', 
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET /api/teams/:teamId/current - Get team's current season
router.get('/:teamId/current', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Validate teamId
    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({ 
        error: 'Invalid team ID',
        message: 'Team ID must be a valid number'
      });
    }
    
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        error: 'Team not found',
        message: `No team found with ID ${teamId}`
      });
    }

    const currentSeason = await Season.getCurrentSeason(teamId);
    if (!currentSeason) {
      return res.status(404).json({ 
        error: 'No current season data',
        message: `No season data found for team ${team.team_name}`
      });
    }

    const seasonStats = await Season.getSeasonStats(currentSeason.season_id);
    res.json({ team, currentSeason, stats: seasonStats });
  } catch (error) {
    console.error('Error fetching team data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch team data', 
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;