const pool = require('./databases');

class Team {
  static async findById(teamId) {
    const query = 'SELECT * FROM teams WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return result.rows[0];
  }

  static async findByName(teamName) {
    const query = 'SELECT * FROM teams WHERE team_name ILIKE $1';
    const result = await pool.query(query, [`%${teamName}%`]);
    return result.rows[0];
  }

  static async getAll() {
    const query = 'SELECT * FROM teams ORDER BY team_name';
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = Team;