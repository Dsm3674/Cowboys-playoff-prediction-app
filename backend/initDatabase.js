
const fs = require('fs');
const path = require('path');
const pool = require('./databases');

function resolveSqlPath(fileName) {
  const candidates = [
    path.join(__dirname, 'Data', fileName),
    path.join(process.cwd(), 'Data', fileName),
    path.join(process.cwd(), 'backend', 'Data', fileName),
    path.join(__dirname, '..', 'Data', fileName),
    path.join(process.cwd(), 'data', fileName)
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));

  if (!found) {
    throw new Error(
      `Unable to find ${fileName}. Checked: ${candidates.join(', ')}`
    );
  }

  return found;
}

async function initDatabase() {
  try {
    console.log('Starting database initialization...');

    const schemaPath = resolveSqlPath('schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log(`Creating tables from ${schemaPath}...`);
    await pool.query(schemaSQL);
    console.log('✓ Tables created successfully');

    const seedPath = resolveSqlPath('seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    console.log(`Seeding initial data from ${seedPath}...`);
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
