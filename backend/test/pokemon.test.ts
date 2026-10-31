import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { pokemon, users } from '../src/db/schema.ts';
import { seedAdmin } from '../scripts/seed-admin.ts';
import { app, db } from './setup.ts';

async function register() {
  const response = await request(app).post('/auth/register').send({
    email: 'trainer@example.com', username: 'Trainer', password: 'test-password',
  }).expect(201);
  return response.body as { token: string; user: { id: string; username: string } };
}

test('an authenticated user creates a Pokémon and reads its creator username', async () => {
  const { token, user } = await register();
  const created = await request(app).post('/pokemon').auth(token, { type: 'bearer' }).send({
    name: ' Pikachu ', types: ['electric'], description: 'An electric Pokémon',
    imageKey: 'images/pikachu.png', createdBy: randomUUID(),
  }).expect(201);

  assert.equal(created.body.name, 'Pikachu');
  assert.deepEqual(created.body.types, ['electric']);
  assert.equal(created.body.createdBy, user.id);
  assert.equal(created.body.description, 'An electric Pokémon');
  assert.equal(created.body.imageKey, 'images/pikachu.png');

  const detail = await request(app).get(`/pokemon/${created.body.id}`)
    .auth(token, { type: 'bearer' }).expect(200);
  assert.equal(detail.body.id, created.body.id);
  assert.equal(detail.body.creatorUsername, user.username);
  assert.equal(detail.body.createdBy, user.id);

  // A soft-deleted creator's Pokémon remains visible to other users.
  const other = await request(app).post('/auth/register').send({
    email: 'other@example.com', username: 'Other', password: 'test-password',
  }).expect(201);
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
  const afterDeletion = await request(app).get(`/pokemon/${created.body.id}`)
    .auth(other.body.token, { type: 'bearer' }).expect(200);
  assert.equal(afterDeletion.body.creatorUsername, user.username);
});

test('creation validates required fields, types, and description length', async () => {
  const { token } = await register();
  const invalidBodies = [
    {}, { name: ' ', types: ['electric'] }, { name: 'Pikachu', types: [] },
    { name: 'Pikachu', types: ['electric', 'fire', 'water'] },
    { name: 'Pikachu', types: ['unknown'] },
    { name: 'Pikachu', types: ['electric'], description: 'x'.repeat(501) },
    { name: 'Pikachu', types: ['electric'], imageKey: 42 },
  ];
  for (const body of invalidBodies) {
    await request(app).post('/pokemon').auth(token, { type: 'bearer' }).send(body).expect(400);
  }
  assert.equal((await db.select().from(pokemon)).length, 0);
  await request(app).post('/pokemon').auth(token, { type: 'bearer' }).send({
    name: 'Charizard', types: ['fire', 'flying'], description: 'x'.repeat(500),
  }).expect(201);
});

test('detail and creation require authentication; missing or deleted Pokémon cannot be read', async () => {
  await request(app).post('/pokemon').send({ name: 'Pikachu', types: ['electric'] }).expect(401);
  await request(app).get(`/pokemon/${randomUUID()}`).expect(401);
  const { token } = await register();
  await request(app).get('/pokemon/not-a-uuid').auth(token, { type: 'bearer' }).expect(400);
  await request(app).get(`/pokemon/${randomUUID()}`).auth(token, { type: 'bearer' }).expect(404);
  const created = await request(app).post('/pokemon').auth(token, { type: 'bearer' })
    .send({ name: 'Pikachu', types: ['electric'] }).expect(201);
  await db.update(pokemon).set({ deletedAt: new Date() }).where(eq(pokemon.id, created.body.id));
  await request(app).get(`/pokemon/${created.body.id}`).auth(token, { type: 'bearer' }).expect(404);
});

test('only the owner or an admin can update or delete a Pokémon', async () => {
  const owner = await register();
  const other = await request(app).post('/auth/register').send({
    email: 'other@example.com', username: 'Other', password: 'test-password',
  }).expect(201);
  const admin = await seedAdmin('admin@example.com', 'test-password');
  const login = await request(app).post('/auth/login')
    .send({ email: admin.email, password: 'test-password' }).expect(200);
  const adminToken = login.body.token;
  const created = await request(app).post('/pokemon').auth(owner.token, { type: 'bearer' })
    .send({ name: 'Pikachu', types: ['electric'] }).expect(201);
  const path = `/pokemon/${created.body.id}`;

  await request(app).patch(path).auth(other.body.token, { type: 'bearer' })
    .send({ name: 'Stolen' }).expect(403);
  await request(app).delete(path).auth(other.body.token, { type: 'bearer' }).expect(403);
  const unchanged = await request(app).get(path).auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(unchanged.body.name, 'Pikachu');
  assert.equal(unchanged.body.createdBy, owner.user.id);

  const ownerUpdate = await request(app).patch(path).auth(owner.token, { type: 'bearer' })
    .send({ description: 'Owner update', createdBy: other.body.user.id }).expect(200);
  assert.equal(ownerUpdate.body.description, 'Owner update');
  assert.equal(ownerUpdate.body.createdBy, owner.user.id);
  assert.equal(ownerUpdate.body.name, 'Pikachu');

  const adminUpdate = await request(app).patch(path).auth(adminToken, { type: 'bearer' })
    .send({ name: 'Raichu', types: ['electric'] }).expect(200);
  assert.equal(adminUpdate.body.name, 'Raichu');
  assert.equal(adminUpdate.body.createdBy, owner.user.id);
  await request(app).delete(path).auth(adminToken, { type: 'bearer' }).expect(204);
  await request(app).get(path).auth(owner.token, { type: 'bearer' }).expect(404);
  await request(app).patch(path).auth(adminToken, { type: 'bearer' }).send({ name: 'Again' }).expect(404);
  await request(app).delete(path).auth(adminToken, { type: 'bearer' }).expect(404);
  const [stored] = await db.select().from(pokemon).where(eq(pokemon.id, created.body.id));
  assert.ok(stored.deletedAt);

  const second = await request(app).post('/pokemon').auth(owner.token, { type: 'bearer' })
    .send({ name: 'Eevee', types: ['normal'] }).expect(201);
  await request(app).delete(`/pokemon/${second.body.id}`).auth(owner.token, { type: 'bearer' }).expect(204);
  await request(app).get(`/pokemon/${second.body.id}`).auth(owner.token, { type: 'bearer' }).expect(404);
});

test('updates validate partial input and mutations require authentication', async () => {
  const { token } = await register();
  const created = await request(app).post('/pokemon').auth(token, { type: 'bearer' })
    .send({ name: 'Pikachu', types: ['electric'] }).expect(201);
  const path = `/pokemon/${created.body.id}`;
  await request(app).patch(path).send({ name: 'Raichu' }).expect(401);
  await request(app).delete(path).expect(401);
  for (const body of [
    {}, { name: ' ' }, { types: [] }, { types: ['fire', 'water', 'grass'] },
    { types: ['unknown'] }, { description: 'x'.repeat(501) }, { createdBy: randomUUID() },
  ]) {
    await request(app).patch(path).auth(token, { type: 'bearer' }).send(body).expect(400);
  }
  await request(app).patch('/pokemon/not-a-uuid').auth(token, { type: 'bearer' })
    .send({ name: 'Raichu' }).expect(400);
  await request(app).delete('/pokemon/not-a-uuid').auth(token, { type: 'bearer' }).expect(400);
  const missing = `/pokemon/${randomUUID()}`;
  await request(app).patch(missing).auth(token, { type: 'bearer' }).send({ name: 'Raichu' }).expect(404);
  await request(app).delete(missing).auth(token, { type: 'bearer' }).expect(404);
  const unchanged = await request(app).get(path).auth(token, { type: 'bearer' }).expect(200);
  assert.equal(unchanged.body.name, 'Pikachu');
});
