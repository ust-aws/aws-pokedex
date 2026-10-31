import { Router } from 'express';
import { and, asc, eq, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { hashPassword, publicUserFields, requireAdmin, requireAuth } from '../auth.ts';
import { HttpError } from '../errors.ts';
import { validateBody, validateQuery } from '../validation.ts';
import { isDuplicateUser } from './auth.ts';

const PAGE_SIZE = 20;

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
const idSchema = z.uuid();
const updateSchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(['user', 'admin']),
  password: z.string().min(8),
}).partial().refine((input) => Object.keys(input).length > 0, { message: 'No fields to update.' });

function parseId(value: string): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new HttpError(404, 'User not found.');
  return result.data;
}

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get('/', async (req, res) => {
  const { q, page } = validateQuery(listQuerySchema, req);
  const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : undefined;
  const where = and(
    isNull(users.deletedAt),
    pattern ? or(ilike(users.username, pattern), ilike(users.email, pattern)) : undefined,
  );

  const [items, total] = await Promise.all([
    db.select({ ...publicUserFields, createdAt: users.createdAt }).from(users).where(where)
      .orderBy(asc(users.username), asc(users.id))
      .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.$count(users, where),
  ]);
  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

usersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { password, ...input } = validateBody(updateSchema, req);
  if (id === req.user!.id && input.role !== undefined && input.role !== req.user!.role) {
    throw new HttpError(403, 'You cannot change your own role.');
  }

  const changes = { ...input, updatedAt: new Date(), ...(password && { passwordHash: await hashPassword(password) }) };
  let user;
  try {
    [user] = await db.update(users).set(changes)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ ...publicUserFields, createdAt: users.createdAt });
  } catch (error) {
    if (isDuplicateUser(error)) throw new HttpError(409, 'The email or username already exists.');
    throw error;
  }
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user });
});

usersRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === req.user!.id) throw new HttpError(403, 'You cannot delete yourself.');

  const [deleted] = await db.update(users).set({ deletedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id });
  if (!deleted) throw new HttpError(404, 'User not found.');
  res.status(204).end();
});
