import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { requireAuth, requireAdmin } from "../auth.ts";
import { validateQuery } from "../validation.ts";
import { asc, isNull } from "drizzle-orm";

export const adminRouter = Router();

adminRouter.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const items = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.username), users.id);

  res.json({ items });
});