import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import request from 'supertest';
import { app } from './setup.ts';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
const { s3 } = await import('../src/routes/uploads.ts');

async function token(): Promise<string> {
  const res = await request(app).post('/auth/register')
    .send({ email: 'uploader@example.com', username: 'Uploader', password: 'test-password' }).expect(201);
  return res.body.token;
}

// Fake S3: GetObject returns `head`; every command is recorded.
function fakeS3(head: Buffer) {
  const sent: unknown[] = [];
  mock.method(s3, 'send', (async (command: unknown) => {
    sent.push(command);
    if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => head } };
    return {};
  }) as never);
  return sent;
}

async function presignedKey(auth: string): Promise<string> {
  const res = await request(app).post('/uploads/presign').set('Authorization', auth)
    .send({ contentType: 'image/png' }).expect(200);
  return res.body.key;
}

test('confirm moves a real PNG to images/', async (t) => {
  t.after(() => mock.restoreAll());
  const auth = `Bearer ${await token()}`;
  const key = await presignedKey(auth);
  const sent = fakeS3(Buffer.from('89504e470d0a1a0a00000000', 'hex'));

  const res = await request(app).post('/uploads/confirm').set('Authorization', auth).send({ key }).expect(200);
  assert.match(res.body.key, /^images\/[0-9a-f-]{36}\.png$/);
  assert.ok(sent.some((c) => c instanceof CopyObjectCommand));
  assert.ok(sent.some((c) => c instanceof DeleteObjectCommand));
});

test('confirm deletes and rejects a non-image', async (t) => {
  t.after(() => mock.restoreAll());
  const auth = `Bearer ${await token()}`;
  const key = await presignedKey(auth);
  const sent = fakeS3(Buffer.from('<html><body>'));

  await request(app).post('/uploads/confirm').set('Authorization', auth).send({ key }).expect(400);
  assert.ok(sent.some((c) => c instanceof DeleteObjectCommand));
  assert.ok(!sent.some((c) => c instanceof CopyObjectCommand));
});

test("confirm rejects another user's key", async () => {
  const auth = `Bearer ${await token()}`;
  const key = `uploads/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  await request(app).post('/uploads/confirm').set('Authorization', auth).send({ key }).expect(400);
});

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
  assert.match(key, /^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
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
