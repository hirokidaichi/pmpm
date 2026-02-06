import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql, asc } from "drizzle-orm";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import { pmServerMembership, pmUserProfile } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const inviteMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER", "STAKEHOLDER"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "STAKEHOLDER"]).optional(),
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]).optional(),
});

export const serverRoutes = new Hono<AppEnv>()
  .get(
    "/status",
    requireRole("ADMIN"),
    async (c) => {
      const memberCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pmServerMembership);

      const activeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pmServerMembership)
        .where(eq(pmServerMembership.status, "ACTIVE"));

      return c.json({
        version: "0.1.0",
        uptime: process.uptime(),
        members: {
          total: memberCount[0]?.count ?? 0,
          active: activeCount[0]?.count ?? 0,
        },
      });
    },
  )
  .get(
    "/members",
    requireRole("ADMIN"),
    async (c) => {
      const members = await db
        .select({
          userId: pmServerMembership.userId,
          role: pmServerMembership.role,
          status: pmServerMembership.status,
          displayName: pmUserProfile.displayName,
          alias: pmUserProfile.alias,
          createdAt: pmServerMembership.createdAt,
          updatedAt: pmServerMembership.updatedAt,
        })
        .from(pmServerMembership)
        .leftJoin(pmUserProfile, eq(pmServerMembership.userId, pmUserProfile.userId))
        .orderBy(asc(pmServerMembership.createdAt));

      return c.json(members);
    },
  )
  .post(
    "/members/invite",
    requireRole("ADMIN"),
    zValidator("json", inviteMemberSchema),
    async (c) => {
      const input = c.req.valid("json");

      const existing = await db.query.pmServerMembership.findFirst({
        where: eq(pmServerMembership.userId, input.userId),
      });
      if (existing) {
        throw new AppError("MEMBER_ALREADY_EXISTS", "User is already a server member", 409);
      }

      const timestamp = now();
      await db.insert(pmServerMembership).values({
        userId: input.userId,
        role: input.role,
        status: "INVITED",
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return c.json(
        await db.query.pmServerMembership.findFirst({
          where: eq(pmServerMembership.userId, input.userId),
        }),
        201,
      );
    },
  )
  .put(
    "/members/:userId",
    requireRole("ADMIN"),
    zValidator("json", updateMemberSchema),
    async (c) => {
      const userId = c.req.param("userId");
      const input = c.req.valid("json");

      const existing = await db.query.pmServerMembership.findFirst({
        where: eq(pmServerMembership.userId, userId),
      });
      if (!existing) {
        throw new AppError("MEMBER_NOT_FOUND", "Server member not found", 404);
      }

      const updateData: Record<string, unknown> = { updatedAt: now() };
      if (input.role !== undefined) updateData.role = input.role;
      if (input.status !== undefined) updateData.status = input.status;

      await db.update(pmServerMembership).set(updateData).where(eq(pmServerMembership.userId, userId));

      return c.json(
        await db.query.pmServerMembership.findFirst({
          where: eq(pmServerMembership.userId, userId),
        }),
      );
    },
  )
  .delete(
    "/members/:userId",
    requireRole("ADMIN"),
    async (c) => {
      const userId = c.req.param("userId");
      const user = c.get("user")!;

      if (userId === user.id) {
        throw new AppError("CANNOT_REMOVE_SELF", "You cannot remove yourself from the server", 422);
      }

      const existing = await db.query.pmServerMembership.findFirst({
        where: eq(pmServerMembership.userId, userId),
      });
      if (!existing) {
        throw new AppError("MEMBER_NOT_FOUND", "Server member not found", 404);
      }

      await db.delete(pmServerMembership).where(eq(pmServerMembership.userId, userId));
      return c.json({ success: true });
    },
  );
