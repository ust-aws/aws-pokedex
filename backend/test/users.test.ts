import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { app, db } from './setup.ts';
import { hashPassword, signToken, verifyPassword } from '../src/auth.ts';
import { users } from '../src/db/schema.ts';

async function createUser(username: string, role: 'user' | 'admin' = 'user') {
  const [user] = await db.insert(users).values({
    email: `${username.toLowerCase()}@example.com`,
    username,
    passwordHash: await hashPassword('test-password'),
    role,
  }).returning();
  return { ...user, auth: `Bearer ${await signToken(user.id)}` };
}

function assertNoPassword(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    assert.notEqual(key, 'passwordHash');
    assert.notEqual(key, 'password_hash');
    assertNoPassword(child);
  }
}

test('a non-admin gets 403 on every route', async () => {
  const user = await createUser('Trainer');
  const other = await createUser('Other');

  for (const response of [
    await request(app).get('/users').set('Authorization', user.auth),
    await request(app).patch(`/users/${other.id}`).set('Authorization', user.auth).send({ username: 'Renamed' }),
    await request(app).delete(`/users/${other.id}`).set('Authorization', user.auth),
  ]) {
    assert.equal(response.status, 403);
  }
  assert.equal((await request(app).get('/users')).status, 401);
});

test('an admin cannot change their own role or delete themselves', async () => {
  const admin = await createUser('Admin', 'admin');

  const demote = await request(app).patch(`/users/${admin.id}`).set('Authorization', admin.auth).send({ role: 'user' });
  assert.equal(demote.status, 403);
  const remove = await request(app).delete(`/users/${admin.id}`).set('Authorization', admin.auth);
  assert.equal(remove.status, 403);

  const [row] = await db.select().from(users).where(eq(users.id, admin.id));
  assert.equal(row.role, 'admin');
  assert.equal(row.deletedAt, null);

  const rename = await request(app).patch(`/users/${admin.id}`).set('Authorization', admin.auth).send({ username: 'Boss' });
  assert.equal(rename.status, 200);
  assert.equal(rename.body.user.username, 'Boss');
});

test('list searches username and email and pages 20 at a time', async () => {
  const admin = await createUser('Admin', 'admin');
  for (let i = 0; i < 24; i++) await createUser(`Trainer${String(i).padStart(2, '0')}`);

  const first = await request(app).get('/users').set('Authorization', admin.auth);
  assert.equal(first.status, 200);
  assert.equal(first.body.items.length, 20);
  assert.equal(first.body.total, 25);
  assert.equal(first.body.page, 1);
  assert.equal(first.body.pageSize, 20);
  assertNoPassword(first.body);

  const second = await request(app).get('/users?page=2').set('Authorization', admin.auth);
  assert.equal(second.body.items.length, 5);

  const byUsername = await request(app).get('/users?q=trainer07').set('Authorization', admin.auth);
  assert.deepEqual(byUsername.body.items.map((u: { username: string }) => u.username), ['Trainer07']);

  const byEmail = await request(app).get('/users?q=ADMIN@example').set('Authorization', admin.auth);
  assert.deepEqual(byEmail.body.items.map((u: { username: string }) => u.username), ['Admin']);

  const wildcard = await request(app).get('/users?q=%25').set('Authorization', admin.auth);
  assert.equal(wildcard.body.total, 0);

  assert.equal((await request(app).get('/users?page=0').set('Authorization', admin.auth)).status, 400);
});

test('patch updates fields, hashes the password, and rejects duplicates', async () => {
  const admin = await createUser('Admin', 'admin');
  const target = await createUser('Target');
  await createUser('Taken');

  const response = await request(app).patch(`/users/${target.id}`).set('Authorization', admin.auth).send({
    username: 'Renamed',
    email: ' New@Example.com ',
    role: 'admin',
    password: 'another-password',
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, 'Renamed');
  assert.equal(response.body.user.email, 'new@example.com');
  assert.equal(response.body.user.role, 'admin');
  assertNoPassword(response.body);

  const [row] = await db.select().from(users).where(eq(users.id, target.id));
  assert.equal(await verifyPassword('another-password', row.passwordHash), true);

  const duplicate = await request(app).patch(`/users/${target.id}`).set('Authorization', admin.auth).send({ username: 'taken' });
  assert.equal(duplicate.status, 409);

  const empty = await request(app).patch(`/users/${target.id}`).set('Authorization', admin.auth).send({});
  assert.equal(empty.status, 400);
  const shortPassword = await request(app).patch(`/users/${target.id}`).set('Authorization', admin.auth).send({ password: 'short' });
  assert.equal(shortPassword.status, 400);
  const missing = await request(app).patch('/users/00000000-0000-4000-8000-000000000000').set('Authorization', admin.auth).send({ username: 'Nobody' });
  assert.equal(missing.status, 404);
  const badId = await request(app).patch('/users/not-a-uuid').set('Authorization', admin.auth).send({ username: 'Nobody' });
  assert.equal(badId.status, 404);
});

test('a soft-deleted user disappears from the list and their token stops working', async () => {
  const admin = await createUser('Admin', 'admin');
  const target = await createUser('Target');

  const response = await request(app).delete(`/users/${target.id}`).set('Authorization', admin.auth);
  assert.equal(response.status, 204);

  const list = await request(app).get('/users').set('Authorization', admin.auth);
  assert.deepEqual(list.body.items.map((u: { username: string }) => u.username), ['Admin']);
  assert.equal(list.body.total, 1);

  const [row] = await db.select().from(users).where(eq(users.id, target.id));
  assert.notEqual(row.deletedAt, null);
  assert.equal((await request(app).get('/auth/me').set('Authorization', target.auth)).status, 401);

  assert.equal((await request(app).delete(`/users/${target.id}`).set('Authorization', admin.auth)).status, 404);
  assert.equal((await request(app).patch(`/users/${target.id}`).set('Authorization', admin.auth).send({ username: 'Back' })).status, 404);
});
