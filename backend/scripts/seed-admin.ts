import { existsSync } from 'node:fs';
import { z } from 'zod';
import { users } from '../src/db/schema.ts';
import { hashPassword } from '../src/password.ts';

const argumentsSchema = z.tuple([
  z.string().trim().toLowerCase().pipe(z.email()),
  z.string().min(8),
]);

export async function seedAdmin(email: string, password: string) {
  const [normalizedEmail, validPassword] = argumentsSchema.parse([email, password]);
  const { db } = await import('../src/db/index.ts');
  const [admin] = await db.insert(users).values({
    email: normalizedEmail,
    username: normalizedEmail,
    passwordHash: await hashPassword(validPassword),
    role: 'admin',
  }).returning({ id: users.id, email: users.email, username: users.username, role: users.role });
  return admin;
}

if (import.meta.main) {
  const envFile = new URL('../.env', import.meta.url);
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const args = argumentsSchema.safeParse(process.argv.slice(2));
  if (!args.success) {
    console.error('Usage: node backend/scripts/seed-admin.ts <email> <password>');
    console.error('Use a valid email address and a password with at least 8 characters.');
    process.exitCode = 1;
  } else {
    try {
      const admin = await seedAdmin(...args.data);
      console.log(`Admin created: ${admin.email}`);
    } catch {
      console.error('Cannot create the admin. Check the database connection, migrations, and duplicate email or username.');
      process.exitCode = 1;
    } finally {
      const { pool } = await import('../src/db/index.ts');
      await pool.end();
    }
  }
}
