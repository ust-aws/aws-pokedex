import { relations } from "drizzle-orm/relations";
import { users, pokemon } from "./schema.ts";

export const pokemonRelations = relations(pokemon, ({one}) => ({
	user: one(users, {
		fields: [pokemon.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	pokemon: many(pokemon),
}));