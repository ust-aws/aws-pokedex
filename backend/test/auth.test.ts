import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import express from 'express';
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose';
import request from 'supertest';
import { app, db } from './setup.ts';
import { errorHandler } from '../src/app.ts';
import { requireAdmin, requireAuth, signToken, verifyPassword } from '../src/auth.ts';
import { users } from '../src/db/schema.ts';
import { seedAdmin } from '../scripts/seed-admin.ts';

const runFile = promisify(execFile);
const credentials = { email: 'trainer@example.com', username: 'Trainer', password: ' test-password ' };
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

function assertNoPassword(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    assert.notEqual(key, 'passwordHash');
    assert.notEqual(key, 'password_hash');
    assertNoPassword(child);
  }
}

function assertPublicUser(user: Record<string, unknown>): void {
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'role', 'username']);
  assertNoPassword(user);
}

const protectedApp = express();
protectedApp.get('/admin', requireAuth, requireAdmin, (req, res) => res.json({ user: req.user }));
protectedApp.get('/admin-alone', requireAdmin, (_req, res) => res.json({ ok: true }));
protectedApp.use(errorHandler);

test('register, login, and me return public users and eight-hour HS256 tokens', async () => {
  const registered = await request(app).post('/auth/register').send({
    ...credentials, email: ' Trainer@Example.com ', username: ' Trainer ', role: 'admin',
  }).expect(201);
  const { user, token } = registered.body;
  assertPublicUser(user);
  assert.equal(user.email, credentials.email);
  assert.equal(user.username, credentials.username);
  assert.equal(user.role, 'user');
  assert.deepEqual(decodeProtectedHeader(token), { alg: 'HS256', typ: 'JWT' });
  const claims = decodeJwt(token);
  assert.equal(claims.sub, user.id);
  assert.equal(claims.exp! - claims.iat!, 8 * 60 * 60);
  assert.deepEqual(Object.keys(claims).sort(), ['exp', 'iat', 'sub']);

  const [stored] = await db.select().from(users);
  assert.equal(await verifyPassword(credentials.password, stored.passwordHash), true);
  assert.equal(await verifyPassword(credentials.password.trim(), stored.passwordHash), false);

  const loggedIn = await request(app).post('/auth/login')
    .send({ email: ' TRAINER@EXAMPLE.COM ', password: credentials.password }).expect(200);
  assert.deepEqual(loggedIn.body.user, user);
  assertNoPassword(loggedIn.body);
  for (const bearer of [token, loggedIn.body.token]) {
    const me = await request(app).get('/auth/me').auth(bearer, { type: 'bearer' }).expect(200);
    assert.deepEqual(me.body, { user });
    assertNoPassword(me.body);
  }
});

test('a seeded admin can log in and access an admin route', async () => {
  const seeded = await seedAdmin('admin@example.com', 'admin-password');
  const login = await request(app).post('/auth/login')
    .send({ email: seeded.email, password: 'admin-password' }).expect(200);
  assert.equal(login.body.user.role, 'admin');
  assertNoPassword(login.body);
  const response = await request(protectedApp).get('/admin').auth(login.body.token, { type: 'bearer' }).expect(200);
  assertPublicUser(response.body.user);
});

test('invalid registration and login bodies return JSON 400 responses', async () => {
  const invalidRegistrations = [
    {}, { ...credentials, email: 'invalid' }, { ...credentials, username: ' ' },
    { ...credentials, password: 'short' }, { ...credentials, password: 12345678 },
    { ...credentials, username: null },
  ];
  const invalidLogins = [{}, { email: 'invalid', password: 'password' }, { email: credentials.email, password: '' }];
  for (const [path, bodies] of [['register', invalidRegistrations], ['login', invalidLogins]] as const) {
    for (const body of bodies) {
      const response = await request(app).post(`/auth/${path}`).send(body).expect(400);
      assert.equal(typeof response.body.error, 'string');
      assertNoPassword(response.body);
    }
  }
  assert.equal((await db.select().from(users)).length, 0);
});

test('duplicate active emails and usernames are case-insensitive conflicts', async () => {
  await request(app).post('/auth/register').send(credentials).expect(201);
  for (const input of [
    { ...credentials, email: 'TRAINER@EXAMPLE.COM', username: 'Other' },
    { ...credentials, email: 'other@example.com', username: 'TRAINER' },
  ]) {
    const response = await request(app).post('/auth/register').send(input).expect(409);
    assertNoPassword(response.body);
  }
  assert.equal((await db.select().from(users)).length, 1);
});

test('concurrent registrations return one success and one conflict for either unique field', async () => {
  const emailRace = await Promise.all([
    request(app).post('/auth/register').send(credentials),
    request(app).post('/auth/register').send({ ...credentials, username: 'Other' }),
  ]);
  assert.deepEqual(emailRace.map((response) => response.status).sort(), [201, 409]);
  const usernameRace = await Promise.all([
    request(app).post('/auth/register').send({ ...credentials, email: 'one@example.com', username: 'Same' }),
    request(app).post('/auth/register').send({ ...credentials, email: 'two@example.com', username: 'SAME' }),
  ]);
  assert.deepEqual(usernameRace.map((response) => response.status).sort(), [201, 409]);
  for (const response of [...emailRace, ...usernameRace]) assertNoPassword(response.body);
});

test('unknown emails and incorrect passwords return the same generic 401', async () => {
  await request(app).post('/auth/register').send(credentials).expect(201);
  const wrongPassword = await request(app).post('/auth/login')
    .send({ email: credentials.email, password: 'wrong' }).expect(401);
  const missingUser = await request(app).post('/auth/login')
    .send({ email: 'missing@example.com', password: credentials.password }).expect(401);
  assert.deepEqual(wrongPassword.body, { error: 'Invalid email or password.' });
  assert.deepEqual(missingUser.body, wrongPassword.body);
});

test('missing or malformed authorization headers return 401', async () => {
  await request(app).get('/auth/me').expect(401);
  for (const header of ['Basic abc', 'Bearer', 'Bearer bad-token', 'Bearer one two']) {
    const response = await request(app).get('/auth/me').set('Authorization', header).expect(401);
    assert.equal(typeof response.body.error, 'string');
    assertNoPassword(response.body);
  }
});

test('tokens require valid signatures, HS256, UUID subjects, and required unexpired claims', async () => {
  const now = Math.floor(Date.now() / 1000);
  const valid = { sub: randomUUID(), iat: now, exp: now + 3600 };
  const invalidClaims = [
    { iat: now, exp: now + 3600 },
    { sub: valid.sub, exp: now + 3600 },
    { sub: valid.sub, iat: now },
    { ...valid, sub: 'not-a-uuid' },
    { ...valid, exp: now - 1 },
    { ...valid, nbf: now + 3600 },
  ];
  const tokens = await Promise.all(invalidClaims.map((claims) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(secret),
  ));
  tokens.push(await new SignJWT(valid).setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode('a-different-secret-with-at-least-32-bytes')));
  tokens.push(await new SignJWT(valid).setProtectedHeader({ alg: 'HS384' })
    .sign(new Uint8Array(64).fill(1)));
  tokens.push(await signToken(randomUUID()));
  for (const token of tokens) {
    const response = await request(app).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
    assertNoPassword(response.body);
  }
});

test('soft deletion blocks login and old tokens while allowing registration again', async () => {
  const first = await request(app).post('/auth/register').send(credentials).expect(201);
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, first.body.user.id));
  await request(app).post('/auth/login').send({ email: credentials.email, password: credentials.password })
    .expect(401).expect({ error: 'Invalid email or password.' });
  await request(app).get('/auth/me').auth(first.body.token, { type: 'bearer' }).expect(401);
  const second = await request(app).post('/auth/register').send(credentials).expect(201);
  assert.notEqual(second.body.user.id, first.body.user.id);
  await request(app).get('/auth/me').auth(second.body.token, { type: 'bearer' }).expect(200);
  await request(app).get('/auth/me').auth(first.body.token, { type: 'bearer' }).expect(401);
  assertNoPassword(second.body);
});

test('admin middleware uses live roles and does not trust token role claims', async () => {
  await request(protectedApp).get('/admin').expect(401);
  await request(protectedApp).get('/admin-alone').expect(401);
  const registered = await request(app).post('/auth/register').send(credentials).expect(201);
  const { user, token } = registered.body;
  await request(protectedApp).get('/admin').auth(token, { type: 'bearer' }).expect(403);
  const forgedRole = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id).setIssuedAt().setExpirationTime('8h').sign(secret);
  await request(protectedApp).get('/admin').auth(forgedRole, { type: 'bearer' }).expect(403);
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
  await request(protectedApp).get('/admin').auth(token, { type: 'bearer' }).expect(200);
  const me = await request(app).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
  assert.equal(me.body.user.role, 'admin');
  await db.update(users).set({ role: 'user' }).where(eq(users.id, user.id));
  await request(protectedApp).get('/admin').auth(token, { type: 'bearer' }).expect(403);
});

test('database errors reach the generic 500 handler instead of returning 401', async (t) => {
  const registered = await request(app).post('/auth/register').send(credentials).expect(201);
  t.mock.method(db, 'select', () => { throw new Error('private database details'); });
  t.mock.method(console, 'error', () => {});
  await request(app).get('/auth/me').auth(registered.body.token, { type: 'bearer' })
    .expect(500).expect({ error: 'Internal server error.' });
  await request(app).post('/auth/login').send({ email: credentials.email, password: credentials.password })
    .expect(500).expect({ error: 'Internal server error.' });
});

test('the app refuses missing and short JWT secrets before listening', async () => {
  for (const jwtSecret of ['', 'short']) {
    await assert.rejects(runFile(process.execPath, ['--input-type=module', '-e', "await import('./src/app.ts')"], {
      cwd: new URL('../', import.meta.url), env: { ...process.env, JWT_SECRET: jwtSecret },
    }), (error: unknown) => {
      assert.match((error as { stderr: string }).stderr, /JWT_SECRET must contain at least 32 UTF-8 bytes/);
      return true;
    });
  }
});
