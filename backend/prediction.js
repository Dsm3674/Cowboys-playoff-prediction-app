const pool = require('./databases');

class Prediction {
  static async create(predictionData) {
    const query = `
      INSERT INTO predictions (
        season_id, playoff_probability, division_probability,
        conference_probability, superbowl_probability,
        model_version, confidence_score, factors_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      predictionData.seasonId,
      predictionData.playoffProb,
      predictionData.divisionProb,
      predictionData.conferenceProb,
      predictionData.superbowlProb,
      predictionData.modelVersion,
      predictionData.confidenceScore,
      JSON.stringify(predictionData.factors)
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getLatest(seasonId) {
    const query = `
      SELECT * FROM predictions 
      WHERE season_id = $1 
      ORDER BY prediction_date DESC 
      LIMIT 1
    `;
    const result = await pool.query(query, [seasonId]);
    return result.rows[0];
  }

  static async getHistory(seasonId, limit = 10) {
    const query = `
      SELECT * FROM predictions 
      WHERE season_id = $1 
      ORDER BY prediction_date DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [seasonId, limit]);
    return result.rows;
  }
}

module.exports = Prediction;