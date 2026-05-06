
const fs = require('fs');
const path = require('path');
const pool = require('./databases');

function redactDatabaseUrl(value) {
  if (!value) return "not set";

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.username ? "[user]" : ""}${url.username ? ":***@" : ""}${url.host}${url.pathname}`;
  } catch (_error) {
    return "[set but not a valid URL]";
  }
}

function getDatabaseUrlForLog() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

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
    console.log(`Init cwd: ${process.cwd()}`);
    console.log(`Init dirname: ${__dirname}`);
    console.log(`Database URL: ${redactDatabaseUrl(getDatabaseUrlForLog())}`);

    const schemaPath = resolveSqlPath('schema.sql');
    console.log(`Schema path resolved: ${schemaPath}`);
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log(`Creating tables from ${schemaPath}...`);
    await pool.query(schemaSQL);
    console.log('✓ Tables created successfully');

    const seedPath = resolveSqlPath('seed.sql');
    console.log(`Seed path resolved: ${seedPath}`);
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    console.log(`Seeding initial data from ${seedPath}...`);
    await pool.query(seedSQL);
    console.log('✓ Database seeded successfully');

    console.log('✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

initDatabase();
