const pool = require('./databases');

let ownershipColumnsReady = null;

class Prediction {
  static async ensureOwnershipColumns() {
    if (!ownershipColumnsReady) {
      ownershipColumnsReady = (async () => {
        await pool.query(`
          ALTER TABLE predictions
            ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS history_client_id VARCHAR(128)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_predictions_user_email_date
          ON predictions (user_email, prediction_date DESC)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_predictions_history_client_date
          ON predictions (history_client_id, prediction_date DESC)
        `);
      })();
    }

    return ownershipColumnsReady;
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

  static async create(data) {
    await this.ensureOwnershipColumns();

    const query = `
      INSERT INTO predictions (
        season_id,
        playoff_probability,
        division_probability,
        conference_probability,
        superbowl_probability,
        confidence_score,
        factors_json,
        model_version,
        user_email,
        history_client_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      data.modelVersion,
      data.userEmail || null,
      data.historyClientId || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getHistory(seasonId, limit = 20) {
    await this.ensureOwnershipColumns();

    const query = `
      SELECT * FROM predictions
      WHERE season_id = $1
      ORDER BY prediction_date DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [seasonId, limit]);
    return result.rows;
  }

  static async getHistoryForIdentity(identity = {}, limit = 50) {
    await this.ensureOwnershipColumns();

    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const userEmail = String(identity.userEmail || "").trim().toLowerCase();
    const historyClientId = String(identity.historyClientId || "").trim();

    if (userEmail && historyClientId) {
      const result = await pool.query(
        `
          SELECT * FROM predictions
          WHERE user_email = $1
            OR (
              history_client_id = $2
              AND (user_email IS NULL OR user_email = '')
            )
          ORDER BY prediction_date DESC
          LIMIT $3
        `,
        [userEmail, historyClientId, safeLimit]
      );
      return result.rows;
    }

    if (userEmail) {
      const result = await pool.query(
        `
          SELECT * FROM predictions
          WHERE user_email = $1
          ORDER BY prediction_date DESC
          LIMIT $2
        `,
        [userEmail, safeLimit]
      );
      return result.rows;
    }

    if (historyClientId) {
      const result = await pool.query(
        `
          SELECT * FROM predictions
          WHERE history_client_id = $1
            AND (user_email IS NULL OR user_email = '')
          ORDER BY prediction_date DESC
          LIMIT $2
        `,
        [historyClientId, safeLimit]
      );
      return result.rows;
    }

    return [];
  }

  static async getAll() {
    const query = 'SELECT * FROM predictions ORDER BY prediction_date DESC';
    const result = await pool.query(query);
    return result.rows;
  }
}

// NOTE: The orphan `applyChaos` and unused `clamp` helpers that previously
// lived at the bottom of this file have been removed. The real `applyChaos`
// implementation is in ./prediction.js (singular) where it is actually used
// by generateEspnPrediction. Keeping a duplicate here was confusing and
// guaranteed someone would eventually edit the wrong copy.

module.exports = Prediction;
