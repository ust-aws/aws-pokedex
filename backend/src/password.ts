import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, hash, extra] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt ?? '') ||
      !/^[a-f0-9]{128}$/.test(hash ?? '') || extra !== undefined) {
    return false;
  }
  const derived = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}
