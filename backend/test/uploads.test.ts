import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { app } from './setup.ts';

async function token(): Promise<string> {
  const res = await request(app).post('/auth/register')
    .send({ email: 'uploader@example.com', username: 'Uploader', password: 'test-password' }).expect(201);
  return res.body.token;
}

test('presign requires authentication', async () => {
  await request(app).post('/uploads/presign').send({ contentType: 'image/png' }).expect(401);
});

test('presign rejects unsupported content types', async () => {
  const auth = `Bearer ${await token()}`;
  for (const contentType of ['image/gif', 'text/html', '', undefined]) {
    await request(app).post('/uploads/presign').set('Authorization', auth).send({ contentType }).expect(400);
  }
});

test('presign returns a POST policy limited to the key, type, and 2 MB', async () => {
  const auth = `Bearer ${await token()}`;
  const res = await request(app).post('/uploads/presign').set('Authorization', auth)
    .send({ contentType: 'image/jpeg' }).expect(200);

  const { url, fields, key } = res.body;
  assert.match(key, /^images\/[0-9a-f-]{36}\.jpg$/);
  assert.match(url, /test-bucket/);
  assert.equal(fields.key, key);
  assert.equal(fields['Content-Type'], 'image/jpeg');

  const policy = JSON.parse(Buffer.from(fields.Policy, 'base64').toString());
  assert.deepEqual(policy.conditions.find((c: unknown) => Array.isArray(c) && c[0] === 'content-length-range'),
    ['content-length-range', 1, 2 * 1024 * 1024]);
  assert.ok(policy.conditions.some((c: unknown) => Array.isArray(c) && c[0] === 'eq' && c[1] === '$Content-Type'));
  const expiresIn = Date.parse(policy.expiration) - Date.now();
  assert.ok(expiresIn > 0 && expiresIn <= 5 * 60 * 1000);
});
