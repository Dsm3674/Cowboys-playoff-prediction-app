const { Pool } = require('pg');
require('dotenv').config();

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL environment variable is not set - using stub pool for tests');
}

// If DATABASE_URL missing, expose a minimal stubbed pool to avoid process exit in tests
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.PGSSLMODE === 'disable'
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
      max: 20, // maximum number of clients in the pool
      idleTimeoutMillis: 30000, // close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
    })
  : {
      // minimal stub used in tests when no DB is configured
      query: async () => {
        throw new Error('No database configured');
      },
      on: () => {},
      end: async () => {},
    };

if (process.env.DATABASE_URL && pool && typeof pool.on === 'function') {
  pool.on('connect', () => {
    console.log('Database connected successfully');
  });

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    // Don't exit here, let the application handle it
  });
}

// Graceful shutdown
const shutdown = async () => {
  console.log('Closing database pool...');
  await pool.end();
  console.log('Database pool closed');
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = pool;
