import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.ts';
import { validateBody } from '../validation.ts';

const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
const presignSchema = z.object({
  contentType: z.enum(Object.keys(extensions) as [keyof typeof extensions]),
});

// Credentials come from the default provider chain (AWS profile locally, instance role on EC2).
const s3 = new S3Client({ region: process.env.AWS_REGION });

export const uploadsRouter = Router();

uploadsRouter.post('/presign', requireAuth, async (req, res) => {
  const { contentType } = validateBody(presignSchema, req);
  const key = `images/${randomUUID()}.${extensions[contentType]}`;
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
