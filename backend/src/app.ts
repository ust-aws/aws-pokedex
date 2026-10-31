import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import { db } from './db/index.ts';
import { HttpError } from './errors.ts';
import { authRouter } from './routes/auth.ts';
import { uploadsRouter } from './routes/uploads.ts';
import { adminRouter } from "./routes/admin.ts";
import { pokemonRouter } from './routes/pokemon.ts';

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? false }));
app.use(express.json());
app.use('/uploads', uploadsRouter);
app.use('/auth', authRouter);
app.use('/pokemon', pokemonRouter);

app.use(adminRouter);

app.get('/health', async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ ok: true });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  // The JSON parser supplies HTTP status codes for malformed or oversized bodies.
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? 'Request body is too large.' : 'Invalid request body.' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
};

app.use(errorHandler);
