import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import { pmInboxMessage } from "../db/schema.js";

const now = () => Date.now();

const listInboxSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  messageType: z.enum(["MENTION", "ASSIGNMENT", "STATUS_CHANGE", "COMMENT", "DIRECT_MESSAGE", "SYSTEM"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const sendDMSchema = z.object({
  recipientUserId: z.string().min(1),
  title: z.string().min(1).max(200),
  bodyMd: z.string().max(10000).optional(),
});

export const inboxRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listInboxSchema),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");

      const conditions = [eq(pmInboxMessage.recipientUserId, user.id)];
      if (query.unreadOnly) {
        conditions.push(eq(pmInboxMessage.isRead, 0));
      }
      if (query.messageType) {
        conditions.push(eq(pmInboxMessage.messageType, query.messageType));
      }

      const where = and(...conditions);
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const [items, countResult] = await Promise.all([
        db.select().from(pmInboxMessage).where(where).orderBy(desc(pmInboxMessage.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pmInboxMessage).where(where),
      ]);

      return c.json({ items, total: countResult[0]?.count ?? 0, limit, offset });
    },
  )
  .get(
    "/count",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const user = c.get("user")!;
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(pmInboxMessage)
        .where(
          and(
            eq(pmInboxMessage.recipientUserId, user.id),
            eq(pmInboxMessage.isRead, 0),
          ),
        );
      return c.json({ unread: result[0]?.count ?? 0 });
    },
  )
  .post(
    "/read/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const user = c.get("user")!;
      await db
        .update(pmInboxMessage)
        .set({ isRead: 1, readAt: now() })
        .where(
          and(
            eq(pmInboxMessage.id, c.req.param("id")),
            eq(pmInboxMessage.recipientUserId, user.id),
          ),
        );
      return c.json({ success: true });
    },
  )
  .post(
    "/read-all",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const user = c.get("user")!;
      const timestamp = now();
      await db
        .update(pmInboxMessage)
        .set({ isRead: 1, readAt: timestamp })
        .where(
          and(
            eq(pmInboxMessage.recipientUserId, user.id),
            eq(pmInboxMessage.isRead, 0),
          ),
        );
      return c.json({ success: true });
    },
  )
  .post(
    "/send",
    requireRole("STAKEHOLDER"),
    zValidator("json", sendDMSchema),
    async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const id = ulid();
      const timestamp = now();

      await db.insert(pmInboxMessage).values({
        id,
        recipientUserId: input.recipientUserId,
        senderUserId: user.id,
        messageType: "DIRECT_MESSAGE",
        title: input.title,
        bodyMd: input.bodyMd,
        createdAt: timestamp,
      });

      return c.json(
        await db.query.pmInboxMessage.findFirst({ where: eq(pmInboxMessage.id, id) }),
        201,
      );
    },
  );
