import { Router } from 'express';
import { and, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { hashPassword, publicUserFields, requireAuth, signToken, verifyPassword } from '../auth.ts';
import { HttpError } from '../errors.ts';
import { validateBody } from '../validation.ts';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const registerSchema = z.object({
  email: emailSchema,
  username: z.string().trim().min(1),
  password: z.string().min(8),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });

function isDuplicateUser(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505' && 'constraint' in error &&
      (error.constraint === 'users_email_unique' || error.constraint === 'users_username_unique')) {
    return true;
  }
  return 'cause' in error && isDuplicateUser(error.cause);
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const input = validateBody(registerSchema, req);
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    [user] = await db.insert(users).values({
      email: input.email,
      username: input.username,
      passwordHash,
      role: 'user',
    }).returning(publicUserFields);
  } catch (error) {
    if (isDuplicateUser(error)) throw new HttpError(409, 'The email or username already exists.');
    throw error;
  }
  res.status(201).json({ token: await signToken(user.id), user });
});

authRouter.post('/login', async (req, res) => {
  const input = validateBody(loginSchema, req);
  const [user] = await db.select({ ...publicUserFields, passwordHash: users.passwordHash }).from(users)
    .where(and(sql`lower(${users.email}) = ${input.email}`, isNull(users.deletedAt)));
  if (!user || !await verifyPassword(input.password, user.passwordHash)) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  const { passwordHash: _passwordHash, ...publicUser } = user;
  res.json({ token: await signToken(user.id), user: publicUser });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
