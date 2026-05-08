const pool = require('./databases');

class Season {
  static async getCurrentSeason(teamId) {
    const query = `
      SELECT s.*, t.team_name 
      FROM seasons s
      JOIN teams t ON s.team_id = t.team_id
      WHERE s.team_id = $1 
      ORDER BY s.year DESC 
      LIMIT 1
    `;
    const result = await pool.query(query, [teamId]);
    return result.rows[0];
  }

  static async getSeasonStats(seasonId) {
    const query = `
      SELECT 
        AVG(points_scored) as avg_points_scored,
        AVG(points_allowed) as avg_points_allowed,
        AVG(total_yards) as avg_total_yards,
        AVG(turnovers) as avg_turnovers,
        COUNT(*) as games_played
      FROM game_stats
      WHERE season_id = $1
    `;
    const result = await pool.query(query, [seasonId]);
    return result.rows[0];
  }

  static async getSeasonHistory(teamId, limit = 5) {
    const query = `
      SELECT * FROM seasons 
      WHERE team_id = $1 
      ORDER BY year DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [teamId, limit]);
    return result.rows;
  }
}

module.exports = Season;