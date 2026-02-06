import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, like, sql, asc } from "drizzle-orm";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import { pmUserProfile } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  alias: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().max(50).optional(),
});

const listUsersSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const userRoutes = new Hono<AppEnv>()
  .get(
    "/me",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const user = c.get("user")!;
      let profile = await db.query.pmUserProfile.findFirst({
        where: eq(pmUserProfile.userId, user.id),
      });

      if (!profile) {
        // Auto-create profile on first access
        const timestamp = now();
        await db.insert(pmUserProfile).values({
          userId: user.id,
          displayName: user.name ?? user.email,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        profile = await db.query.pmUserProfile.findFirst({
          where: eq(pmUserProfile.userId, user.id),
        });
      }

      return c.json({ ...user, profile });
    },
  )
  .put(
    "/me",
    requireRole("STAKEHOLDER"),
    zValidator("json", updateProfileSchema),
    async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");

      // Check alias uniqueness
      if (input.alias) {
        const existing = await db.query.pmUserProfile.findFirst({
          where: eq(pmUserProfile.alias, input.alias),
        });
        if (existing && existing.userId !== user.id) {
          throw new AppError("ALIAS_TAKEN", `Alias '${input.alias}' is already taken`, 409);
        }
      }

      const profileExists = await db.query.pmUserProfile.findFirst({
        where: eq(pmUserProfile.userId, user.id),
      });

      const timestamp = now();

      if (profileExists) {
        const updateData: Record<string, unknown> = { updatedAt: timestamp };
        if (input.displayName !== undefined) updateData.displayName = input.displayName;
        if (input.alias !== undefined) updateData.alias = input.alias;
        if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
        if (input.timezone !== undefined) updateData.timezone = input.timezone;

        await db.update(pmUserProfile).set(updateData).where(eq(pmUserProfile.userId, user.id));
      } else {
        await db.insert(pmUserProfile).values({
          userId: user.id,
          displayName: input.displayName ?? user.name ?? user.email,
          alias: input.alias,
          avatarUrl: input.avatarUrl,
          timezone: input.timezone,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      return c.json(
        await db.query.pmUserProfile.findFirst({
          where: eq(pmUserProfile.userId, user.id),
        }),
      );
    },
  )
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listUsersSchema),
    async (c) => {
      const query = c.req.valid("query");
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const conditions = [];
      if (query.search) {
        conditions.push(
          like(pmUserProfile.displayName, `%${query.search}%`),
        );
      }

      const where = conditions.length > 0 ? conditions[0] : undefined;

      const [items, countResult] = await Promise.all([
        db.select().from(pmUserProfile).where(where).orderBy(asc(pmUserProfile.displayName)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pmUserProfile).where(where),
      ]);

      return c.json({ items, total: countResult[0]?.count ?? 0, limit, offset });
    },
  )
  .get(
    "/:alias",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const alias = c.req.param("alias");
      const profile = await db.query.pmUserProfile.findFirst({
        where: eq(pmUserProfile.alias, alias),
      });
      if (!profile) {
        throw new AppError("USER_NOT_FOUND", `User with alias '${alias}' not found`, 404);
      }
      return c.json(profile);
    },
  );
