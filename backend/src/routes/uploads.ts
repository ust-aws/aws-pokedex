import { randomUUID } from 'node:crypto';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.ts';
import { validateBody } from '../validation.ts';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { HttpError } from '../errors.ts';


const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

// Every real file of these formats starts with these bytes.
const signatures: Record<string, (head: Buffer) => boolean> = {
  png: (head) => head.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  jpg: (head) => head.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
  webp: (head) => head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP',
};
const confirmSchema = z.object({ key: z.string() });

const presignSchema = z.object({
  contentType: z.enum(Object.keys(extensions) as [keyof typeof extensions]),
});

// Credentials come from the default provider chain (AWS profile locally, instance role on EC2).
export const s3 = new S3Client({ region: process.env.AWS_REGION });

export const uploadsRouter = Router();

uploadsRouter.post('/presign', requireAuth, async (req, res) => {
  const { contentType } = validateBody(presignSchema, req);
  const key = `uploads/${req.user!.id}/${randomUUID()}.${extensions[contentType]}`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: process.env.IMAGES_BUCKET!,
    Key: key,
    Conditions: [
      ['content-length-range', 1, 2 * 1024 * 1024],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 300,
  });
  res.json({ url, fields, key });
});

uploadsRouter.post('/confirm', requireAuth, async (req, res) => {
  const { key } = validateBody(confirmSchema, req);
  const match = /^uploads\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(png|jpg|webp)$/.exec(key);
  if (!match || match[1] !== req.user!.id) throw new HttpError(400, 'Invalid upload key.');
  const [, , id, ext] = match;
  const Bucket = process.env.IMAGES_BUCKET!;

  let head: Buffer;
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket, Key: key, Range: 'bytes=0-11' }));
    head = Buffer.from(await object.Body!.transformToByteArray());
  } catch (err) {
    if (err instanceof NoSuchKey) throw new HttpError(404, 'Upload not found.');
    throw err;
  }

  if (!signatures[ext](head)) {
    await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    throw new HttpError(400, 'File is not a valid image.');
  }

  const imageKey = `images/${id}.${ext}`;
  await s3.send(new CopyObjectCommand({ Bucket, Key: imageKey, CopySource: `${Bucket}/${key}` }));
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  res.json({ key: imageKey });
});

