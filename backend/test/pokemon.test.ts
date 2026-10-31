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

test('list searches by name, filters either type, and excludes soft-deleted Pokémon', async () => {
  const owner = await register();
  const records = await db.insert(pokemon).values([
    { name: 'Pikachu', types: ['electric'], createdBy: owner.user.id },
    { name: 'Pika Flyer', types: ['electric', 'flying'], createdBy: owner.user.id },
    { name: 'Pika Flame', types: ['fire'], createdBy: owner.user.id },
    { name: 'Charizard', types: ['fire', 'flying'], createdBy: owner.user.id },
  ]).returning();

  await request(app).get('/pokemon').expect(401);
  const search = await request(app).get('/pokemon').query({ q: 'pIkA' })
    .auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(search.body.total, 3);
  assert.deepEqual(new Set(search.body.items.map((item: { name: string }) => item.name)),
    new Set(['Pikachu', 'Pika Flyer', 'Pika Flame']));
  assert.equal(search.body.items[0].creatorUsername, 'Trainer');

  const combined = await request(app).get('/pokemon').query({ q: 'pika', type: 'flying' })
    .auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(combined.body.total, 1);
  assert.equal(combined.body.items[0].name, 'Pika Flyer');
  const flying = await request(app).get('/pokemon').query({ type: 'flying' })
    .auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(flying.body.total, 2);

  await request(app).delete(`/pokemon/${records[1].id}`).auth(owner.token, { type: 'bearer' }).expect(204);
  const afterDelete = await request(app).get('/pokemon').query({ q: 'pika', type: 'flying' })
    .auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(afterDelete.body.total, 0);
  assert.deepEqual(afterDelete.body.items, []);
  const all = await request(app).get('/pokemon?q=&type=')
    .auth(owner.token, { type: 'bearer' }).expect(200);
  assert.equal(all.body.total, 3);
  assert.ok(all.body.items.every((item: { id: string }) => item.id !== records[1].id));
});

test('list paginates matching results with a stable order and validates queries', async () => {
  const { token, user } = await register();
  await db.insert(pokemon).values(Array.from({ length: 22 }, (_, i) => ({
    name: `Pika ${String(i).padStart(2, '0')}`,
    types: ['electric'],
    createdBy: user.id,
  })));
  await db.insert(pokemon).values({ name: 'Pika fire', types: ['fire'], createdBy: user.id });
  const getPage = (page: number) => request(app).get('/pokemon')
    .query({ q: 'PIKA', type: 'electric', page }).auth(token, { type: 'bearer' }).expect(200);
  const first = await getPage(1);
  const second = await getPage(2);
  const beyond = await getPage(3);
  assert.equal(first.body.total, 22);
  assert.equal(first.body.page, 1);
  assert.equal(first.body.pageSize, 20);
  assert.equal(first.body.items.length, 20);
  assert.equal(second.body.total, 22);
  assert.equal(second.body.page, 2);
  assert.equal(second.body.items.length, 2);
  assert.equal(new Set([...first.body.items, ...second.body.items].map((item: { id: string }) => item.id)).size, 22);
  assert.equal(beyond.body.total, 22);
  assert.deepEqual(beyond.body.items, []);
  const repeated = await getPage(1);
  assert.deepEqual(first.body.items.map((item: { id: string }) => item.id),
    repeated.body.items.map((item: { id: string }) => item.id));

  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=1&page=2',
    'page=999999999999999999999', 'type=unknown']) {
    await request(app).get(`/pokemon?${query}`).auth(token, { type: 'bearer' }).expect(400);
  }
});
