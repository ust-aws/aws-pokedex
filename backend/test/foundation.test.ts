import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { promisify } from 'node:util';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { app, db, pool } from './setup.ts';
import { errorHandler } from '../src/app.ts';
import { users, pokemon } from '../src/db/schema.ts';
import { HttpError } from '../src/errors.ts';
import { hashPassword, verifyPassword } from '../src/password.ts';
import { validateBody, validateQuery } from '../src/validation.ts';
import { seedAdmin } from '../scripts/seed-admin.ts';

const runFile = promisify(execFile);

test('health pings PostgreSQL and returns JSON', async () => {
  await request(app).get('/health').expect(200).expect('Content-Type', /json/).expect({ ok: true });
});

test('health returns a generic JSON error when the database is unavailable', async (t) => {
  t.mock.method(db, 'execute', async () => { throw new Error('private database details'); });
  t.mock.method(console, 'error', () => {});
  await request(app).get('/health').expect(500).expect({ error: 'Internal server error.' });
});

test('CORS permits only the configured origin, including preflight', async () => {
  await request(app).get('/health').set('Origin', process.env.CORS_ORIGIN!)
    .expect('Access-Control-Allow-Origin', process.env.CORS_ORIGIN!).expect(200);
  const denied = await request(app).get('/health').set('Origin', 'https://untrusted.example').expect(200);
  assert.notEqual(denied.headers['access-control-allow-origin'], 'https://untrusted.example');
  await request(app).options('/health').set('Origin', process.env.CORS_ORIGIN!)
    .set('Access-Control-Request-Method', 'GET')
    .expect('Access-Control-Allow-Origin', process.env.CORS_ORIGIN!).expect(204);
});

test('unknown routes return a JSON 404', async () => {
  await request(app).get('/missing').expect(404).expect({ error: 'Route not found.' });
});

test('malformed JSON returns a JSON 400', async () => {
  await request(app).post('/missing').set('Content-Type', 'application/json').send('{')
    .expect(400).expect({ error: 'Invalid request body.' });
});

test('oversized JSON returns a JSON 413', async () => {
  await request(app).post('/missing').send({ value: 'x'.repeat(110_000) })
    .expect(413).expect({ error: 'Request body is too large.' });
});

const validationApp = express();
validationApp.use(express.json());
validationApp.post('/body', (req, res) => {
  res.json(validateBody(z.object({ name: z.string().trim().min(1) }), req));
});
validationApp.get('/query', (req, res) => {
  res.json(validateQuery(z.object({ page: z.coerce.number().int().min(1).default(1) }), req));
});
validationApp.get('/error', async () => {
  throw new HttpError(409, 'The user already exists.');
});
validationApp.use(errorHandler);

test('body validation returns parsed data and rejects invalid bodies', async () => {
  await request(validationApp).post('/body').send({ name: ' Pikachu ', extra: true })
    .expect(200).expect({ name: 'Pikachu' });
  const response = await request(validationApp).post('/body').send({ name: 42 }).expect(400);
  assert.equal(typeof response.body.error, 'string');
  assert.match(response.body.error, /name/);
});

test('query validation supports coercion and defaults without assigning req.query', async () => {
  await request(validationApp).get('/query?page=2').expect(200).expect({ page: 2 });
  await request(validationApp).get('/query').expect(200).expect({ page: 1 });
  for (const query of ['page=0', 'page=invalid', 'page=1&page=2']) {
    const response = await request(validationApp).get(`/query?${query}`).expect(400);
    assert.equal(typeof response.body.error, 'string');
  }
});

test('async HTTP errors preserve their status and message', async () => {
  await request(validationApp).get('/error').expect(409).expect({ error: 'The user already exists.' });
});

test('password hashes use separate salts and verify credentials', async () => {
  const first = await hashPassword('test-password');
  const second = await hashPassword('test-password');
  assert.match(first, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('test-password', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  for (const hash of ['', 'scrypt$salt$hash', `${first}$extra`]) {
    assert.equal(await verifyPassword('test-password', hash), false);
  }
});

test('the seed CLI creates an admin with a usable password hash', async () => {
  const result = await runFile(process.execPath, [
    'scripts/seed-admin.ts', 'Admin@Example.com', 'test-password',
  ], { cwd: new URL('../', import.meta.url), env: { ...process.env } });
  assert.match(result.stdout, /Admin created: admin@example.com/);
  assert.equal(result.stdout.includes('test-password'), false);
  const [admin] = await db.select().from(users);
  assert.equal(admin.email, 'admin@example.com');
  assert.equal(admin.username, 'admin@example.com');
  assert.equal(admin.role, 'admin');
  assert.equal(await verifyPassword('test-password', admin.passwordHash), true);
  await assert.rejects(seedAdmin('admin@example.com', 'another-password'));
  assert.equal((await db.select().from(users)).length, 1);
});

test('invalid seed arguments create no users', async () => {
  await assert.rejects(seedAdmin('invalid', 'test-password'));
  await assert.rejects(seedAdmin('admin@example.com', 'short'));
  await assert.rejects(runFile(process.execPath, ['scripts/seed-admin.ts'], {
    cwd: new URL('../', import.meta.url), env: { ...process.env },
  }), (error: unknown) => {
    assert.match((error as { stderr: string }).stderr, /Usage:/);
    return true;
  });
  assert.equal((await db.select().from(users)).length, 0);
});

test('fixtures can include users and their Pokemon', async () => {
  const admin = await seedAdmin('fixture@example.com', 'test-password');
  await db.insert(pokemon).values({ name: 'Pikachu', types: ['electric'], createdBy: admin.id });
  assert.equal((await db.select().from(pokemon)).length, 1);
});

test('the harness clears both tables between tests', async () => {
  assert.equal((await pool.query('SELECT * FROM users')).rowCount, 0);
  assert.equal((await pool.query('SELECT * FROM pokemon')).rowCount, 0);
});

test('the harness refuses a database other than pokedex_test before connecting', async () => {
  const unsafeUrl = new URL(process.env.DATABASE_URL!);
  unsafeUrl.pathname = '/pokedex';
  await assert.rejects(runFile(process.execPath, ['test/setup.ts'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, TEST_DATABASE_URL: unsafeUrl.toString() },
  }), (error: unknown) => {
    assert.match((error as { stderr: string }).stderr, /TEST_DATABASE_URL must use the pokedex_test database/);
    return true;
  });
});
