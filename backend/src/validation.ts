import type { Request } from 'express';
import { z } from 'zod';
import { HttpError } from './errors.ts';

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues.map((issue) =>
      `${issue.path.join('.') || 'request'}: ${issue.message}`,
    ).join('; ');
    throw new HttpError(400, message);
  }
  return result.data;
}

export function validateBody<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return parse(schema, req.body);
}

export function validateQuery<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return parse(schema, req.query);
}
