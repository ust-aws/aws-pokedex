import { pgTable, uniqueIndex, uuid, text, timestamp, index, foreignKey, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userRole = pgEnum("user_role", ['user', 'admin'])


export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: userRole().default('user').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("users_email_unique").using("btree", sql`lower(email)`).where(sql`(deleted_at IS NULL)`),
	uniqueIndex("users_username_unique").using("btree", sql`lower(username)`).where(sql`(deleted_at IS NULL)`),
]);

export const pokemon = pgTable("pokemon", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	types: text().array().notNull(),
	description: text(),
	imageKey: text("image_key"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("pokemon_name_idx").using("btree", sql`lower(name)`),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "pokemon_created_by_users_id_fk"
		}),
	check("pokemon_types_count", sql`(cardinality(types) >= 1) AND (cardinality(types) <= 2)`),
	check("pokemon_types_valid", sql`types <@ ARRAY['normal'::text, 'fire'::text, 'water'::text, 'electric'::text, 'grass'::text, 'ice'::text, 'fighting'::text, 'poison'::text, 'ground'::text, 'flying'::text, 'psychic'::text, 'bug'::text, 'rock'::text, 'ghost'::text, 'dragon'::text, 'dark'::text, 'steel'::text, 'fairy'::text]`),
]);
