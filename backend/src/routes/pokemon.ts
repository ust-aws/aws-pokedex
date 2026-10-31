import { Router } from 'express';
import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../auth.ts';
import { db } from '../db/index.ts';
import { pokemon, POKEMON_TYPES, users } from '../db/schema.ts';
import { HttpError } from '../errors.ts';
import { validateBody } from '../validation.ts';

const createPokemonSchema = z.object({
  name: z.string().trim().min(1),
  types: z.array(z.enum(POKEMON_TYPES)).min(1).max(2),
  description: z.string().max(500).optional(),
  imageKey: z.string().optional(),
});

export const pokemonRouter = Router();

pokemonRouter.post('/', requireAuth, async (req, res) => {
  const input = validateBody(createPokemonSchema, req);
  const [created] = await db.insert(pokemon).values({
    ...input,
    createdBy: req.user!.id,
  }).returning();
  res.status(201).json(created);
});

pokemonRouter.get('/:id', requireAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(400, 'Invalid Pokémon ID.');

  const [result] = await db.select({
    ...getTableColumns(pokemon),
    creatorUsername: users.username,
  }).from(pokemon)
    .innerJoin(users, eq(pokemon.createdBy, users.id))
    .where(and(eq(pokemon.id, id.data), isNull(pokemon.deletedAt)));

  if (!result) throw new HttpError(404, 'Pokémon not found.');
  res.json(result);
});
