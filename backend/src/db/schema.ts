import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

export const userRole = pgEnum('user_role', ['user', 'admin']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    ...timestamps,
  },
  (t) => [
    // unique only among non-deleted users, so a soft-deleted email can register again
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`).where(sql`${t.deletedAt} is null`),
    uniqueIndex('users_username_unique').on(sql`lower(${t.username})`).where(sql`${t.deletedAt} is null`),
  ],
);

export const pokemon = pgTable(
  'pokemon',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    types: text('types').array().notNull(),
    description: text('description'),
    imageKey: text('image_key'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('pokemon_name_idx').on(sql`lower(${t.name})`),
    check('pokemon_types_count', sql`cardinality(${t.types}) between 1 and 2`),
    check(
      'pokemon_types_valid',
      // DDL can't take bind params, so the (constant) type names are inlined
      sql`${t.types} <@ ARRAY[${sql.raw(POKEMON_TYPES.map((type) => `'${type}'`).join(', '))}]::text[]`,
    ),
  ],
);
