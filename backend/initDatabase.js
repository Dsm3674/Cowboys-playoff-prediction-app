
const fs = require('fs');
const path = require('path');
const pool = require('./databases');

async function initDatabase() {
  try {
    console.log('Starting database initialization...');

    const schemaPath = path.join(__dirname, '../Data/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('Creating tables...');
    await pool.query(schemaSQL);
    console.log('✓ Tables created successfully');

    const seedPath = path.join(__dirname, '../Data/seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    console.log('Seeding initial data...');
    await pool.query(seedSQL);
    console.log('✓ Database seeded successfully');

    console.log('✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

initDatabase();
