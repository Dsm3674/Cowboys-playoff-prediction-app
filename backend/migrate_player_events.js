/**
 * migrate_player_events.js
 * Creates player_events table if missing
 * Runs automatically on server startup
 */

const pool = require("./databases");

async function migratePlayerEvents() {
  try {
    // Check if player_events table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'player_events'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log("✅ player_events table already exists");
      return true;
    }

    // Create player_events table
    console.log("📊 Creating player_events table...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_events (
        id SERIAL PRIMARY KEY,
        player_id INTEGER,
        player_name VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_date DATE NOT NULL,
        description TEXT,
        impact_score DECIMAL(5, 2),
        season INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_event UNIQUE (player_name, event_date, event_type)
      );
    `);

    console.log("✅ player_events table created successfully");

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_player_events_season 
      ON player_events(season DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_player_events_player_date 
      ON player_events(player_name, event_date DESC);
    `);

    console.log("✅ Indexes created for player_events table");
    return true;
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    
    // If table already exists error, continue
    if (error.message.includes("already exists")) {
      console.log("✅ player_events table already exists (from error check)");
      return true;
    }
    
    return false;
  }
}

// Run migration
async function run() {
  const success = await migratePlayerEvents();
  process.exit(success ? 0 : 1);
}

run().catch((error) => {
  console.error("❌ Unexpected migration error:", error);
  process.exit(1);
});

module.exports = { migratePlayerEvents };
