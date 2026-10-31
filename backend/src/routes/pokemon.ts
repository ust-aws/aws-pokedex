import { Router } from 'express';
import { and, asc, count, eq, getTableColumns, ilike, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../auth.ts';
import { db } from '../db/index.ts';
import { pokemon, POKEMON_TYPES, users } from '../db/schema.ts';
import { HttpError } from '../errors.ts';
import { validateBody, validateQuery } from '../validation.ts';

const createPokemonSchema = z.object({
  name: z.string().trim().min(1),
  types: z.array(z.enum(POKEMON_TYPES)).min(1).max(2),
  description: z.string().max(500).optional(),
  imageKey: z.string().optional(),
});
const updatePokemonSchema = createPokemonSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'At least one field is required.' },
);
const PAGE_SIZE = 20;
const listPokemonSchema = z.object({
  q: z.string().trim().default(''),
  type: z.union([z.enum(POKEMON_TYPES), z.literal('')]).default(''),
  page: z.string().regex(/^[1-9]\d*$/).default('1').transform(Number)
    .refine((value) => Number.isSafeInteger(value * PAGE_SIZE), 'Page is too large.'),
});

function parsePokemonId(value: unknown): string {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new HttpError(400, 'Invalid Pokémon ID.');
  return id.data;
}

async function throwMissingOrForbidden(id: string): Promise<never> {
  const [existing] = await db.select({ id: pokemon.id }).from(pokemon)
    .where(and(eq(pokemon.id, id), isNull(pokemon.deletedAt)));
  if (!existing) throw new HttpError(404, 'Pokémon not found.');
  throw new HttpError(403, 'You cannot change this Pokémon.');
}

export const pokemonRouter = Router();

pokemonRouter.get('/', requireAuth, async (req, res) => {
  const { q, type, page } = validateQuery(listPokemonSchema, req);
  const filter = and(
    isNull(pokemon.deletedAt),
    q ? ilike(pokemon.name, `%${q}%`) : undefined,
    type ? sql`${type} = ANY(${pokemon.types})` : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db.select({ ...getTableColumns(pokemon), creatorUsername: users.username })
      .from(pokemon).innerJoin(users, eq(pokemon.createdBy, users.id))
      .where(filter).orderBy(asc(pokemon.createdAt), asc(pokemon.id))
      .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(pokemon).where(filter),
  ]);
  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

pokemonRouter.post('/', requireAuth, async (req, res) => {
  const input = validateBody(createPokemonSchema, req);
  const [created] = await db.insert(pokemon).values({
    ...input,
    createdBy: req.user!.id,
  }).returning();
  res.status(201).json(created);
});

pokemonRouter.get('/:id', requireAuth, async (req, res) => {
  const id = parsePokemonId(req.params.id);

  const [result] = await db.select({
    ...getTableColumns(pokemon),
    creatorUsername: users.username,
  }).from(pokemon)
    .innerJoin(users, eq(pokemon.createdBy, users.id))
    .where(and(eq(pokemon.id, id), isNull(pokemon.deletedAt)));

  if (!result) throw new HttpError(404, 'Pokémon not found.');
  res.json(result);
});

pokemonRouter.patch('/:id', requireAuth, async (req, res) => {
  const id = parsePokemonId(req.params.id);
  const input = validateBody(updatePokemonSchema, req);
  const [updated] = await db.update(pokemon).set({ ...input, updatedAt: new Date() })
    .where(and(
      eq(pokemon.id, id),
      isNull(pokemon.deletedAt),
      req.user!.role === 'admin' ? undefined : eq(pokemon.createdBy, req.user!.id),
    )).returning();
  if (!updated) return throwMissingOrForbidden(id);
  res.json(updated);
});

pokemonRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = parsePokemonId(req.params.id);
  const now = new Date();
  const [deleted] = await db.update(pokemon).set({ deletedAt: now, updatedAt: now })
    .where(and(
      eq(pokemon.id, id),
      isNull(pokemon.deletedAt),
      req.user!.role === 'admin' ? undefined : eq(pokemon.createdBy, req.user!.id),
    )).returning({ id: pokemon.id });
  if (!deleted) return throwMissingOrForbidden(id);
  res.status(204).end();
});
