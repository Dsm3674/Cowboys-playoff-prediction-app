const fs = require('fs');
const path = require('path');
const pool = require('./databases');

async function initDatabase() {
  try {
    console.log('Starting database initialization...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('Creating tables...');
    await pool.query(schemaSQL);
    console.log('✓ Tables created successfully');

    // Read seed file
    const seedPath = path.join(__dirname, 'seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    // Execute seed data
    console.log('Seeding initial data...');
    await pool.query(seedSQL);
    console.log('✓ Database seeded successfully');

    console.log('\n✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error(error);
    process.exit(1);
  }
}

initDatabase();