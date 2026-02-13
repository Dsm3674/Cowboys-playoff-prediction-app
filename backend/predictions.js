const pool = require('./databases');

class Prediction {
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

  static async create(data) {
    const query = `
      INSERT INTO predictions (
        season_id, 
        playoff_probability, 
        division_probability, 
        conference_probability, 
        superbowl_probability,
        confidence_score,
        factors_json,
        model_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      data.seasonId,
      data.playoffProb,
      data.divisionProb,
      data.conferenceProb,
      data.superbowlProb,
      data.confidenceScore,
      JSON.stringify(data.factors),
      data.modelVersion
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getHistory(seasonId, limit = 20) {
    const query = `
      SELECT * FROM predictions 
      WHERE season_id = $1 
      ORDER BY prediction_date DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [seasonId, limit]);
    return result.rows;
  }

  static async getAll() {
    const query = 'SELECT * FROM predictions ORDER BY prediction_date DESC';
    const result = await pool.query(query);
    return result.rows;
  }
}

function applyChaos(p, chaos = 0) {
  const c = Math.max(0, Math.min(1, Number(chaos) || 0));

  // pull toward 0.5 as chaos increases
  let mixed = (1 - c) * p + c * 0.5;

 
  const jitter = (Math.random() - 0.5) * 0.22 * c; // up to ±11% at full chaos
  mixed = mixed + jitter;

  return clamp(mixed, 0.05, 0.95);
}


module.exports = Prediction;
