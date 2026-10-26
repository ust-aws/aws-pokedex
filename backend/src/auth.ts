import type { RequestHandler } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { db } from './db/index.ts';
import { users } from './db/schema.ts';
import { HttpError } from './errors.ts';

export { hashPassword, verifyPassword } from './password.ts';

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
if (secret.byteLength < 32) {
  throw new Error('JWT_SECRET must contain at least 32 UTF-8 bytes.');
}

export const publicUserFields = {
  id: users.id,
  email: users.email,
  username: users.username,
  role: users.role,
};

export type PublicUser = Pick<typeof users.$inferSelect, 'id' | 'email' | 'username' | 'role'>;

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    requiredClaims: ['sub', 'iat', 'exp'],
  });
  return z.uuid().parse(payload.sub);
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') ?? '');
  if (!match) throw new HttpError(401, 'Authentication required.');

  let userId: string;
  try {
    userId = await verifyToken(match[1]);
  } catch {
    throw new HttpError(401, 'Invalid or expired token.');
  }

  const [user] = await db.select(publicUserFields).from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  if (!user) throw new HttpError(401, 'Invalid or expired token.');
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Authentication required.');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admin access required.');
  next();
};
