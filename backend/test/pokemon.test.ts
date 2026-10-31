import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { pokemon, users } from '../src/db/schema.ts';
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
