import { after, before, beforeEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const developmentUrl = process.env.DATABASE_URL ?? 'postgres://pokedex:pokedex@localhost:5432/pokedex';
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? developmentUrl);
if (!process.env.TEST_DATABASE_URL) testUrl.pathname = '/pokedex_test';
if (decodeURIComponent(testUrl.pathname) !== '/pokedex_test') {
  throw new Error('TEST_DATABASE_URL must use the pokedex_test database.');
}
if (new URL(developmentUrl).pathname === testUrl.pathname) {
  throw new Error('The development and test databases must be different.');
}

process.env.DATABASE_URL = testUrl.toString();
process.env.CORS_ORIGIN = 'http://localhost:3001';
process.env.JWT_SECRET = 'pokedex-test-secret-for-integration-tests-only';

process.env.AWS_REGION = 'ap-southeast-1';
process.env.IMAGES_BUCKET = 'test-bucket';
// Signing is local, so fake keys work and the tests never call AWS.
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Import the application only after selecting the test database.
export const { db, pool } = await import('../src/db/index.ts');
export const { app } = await import('../src/app.ts');

before(async () => {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const adminPool = new Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  try {
    const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', ['pokedex_test']);
    if (result.rowCount === 0) await adminPool.query('CREATE DATABASE pokedex_test');
  } finally {
    await adminPool.end();
  }
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE pokemon, users RESTART IDENTITY CASCADE');
});

after(async () => {
  await pool.end();
});
