import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import { pmWebhook, pmWebhookDelivery } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().max(256).optional(),
  events: z.array(z.string()).min(1),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().max(256).optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

const listDeliveriesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const webhookRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("ADMIN"),
    async (c) => {
      const webhooks = await db.select().from(pmWebhook).orderBy(desc(pmWebhook.createdAt));
      return c.json(
        webhooks.map((w) => ({
          ...w,
          secret: w.secret ? "****" : null,
          isActive: w.isActive === 1,
          events: JSON.parse(w.eventsJson) as string[],
        })),
      );
    },
  )
  .post(
    "/",
    requireRole("ADMIN"),
    zValidator("json", createWebhookSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const id = ulid();
      const timestamp = now();

      await db.insert(pmWebhook).values({
        id,
        name: input.name,
        url: input.url,
        secret: input.secret,
        eventsJson: JSON.stringify(input.events),
        createdBy: user.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const webhook = await db.query.pmWebhook.findFirst({ where: eq(pmWebhook.id, id) });
      return c.json(
        {
          ...webhook!,
          secret: webhook!.secret ? "****" : null,
          isActive: webhook!.isActive === 1,
          events: input.events,
        },
        201,
      );
    },
  )
  .put(
    "/:id",
    requireRole("ADMIN"),
    zValidator("json", updateWebhookSchema),
    async (c) => {
      const webhookId = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.pmWebhook.findFirst({
        where: eq(pmWebhook.id, webhookId),
      });
      if (!existing) {
        throw new AppError("WEBHOOK_NOT_FOUND", "Webhook not found", 404);
      }

      const updateData: Record<string, unknown> = { updatedAt: now() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.secret !== undefined) updateData.secret = input.secret;
      if (input.events !== undefined) updateData.eventsJson = JSON.stringify(input.events);
      if (input.isActive !== undefined) updateData.isActive = input.isActive ? 1 : 0;

      await db.update(pmWebhook).set(updateData).where(eq(pmWebhook.id, webhookId));
      const updated = await db.query.pmWebhook.findFirst({ where: eq(pmWebhook.id, webhookId) });
      return c.json({
        ...updated!,
        secret: updated!.secret ? "****" : null,
        isActive: updated!.isActive === 1,
        events: JSON.parse(updated!.eventsJson) as string[],
      });
    },
  )
  .delete(
    "/:id",
    requireRole("ADMIN"),
    async (c) => {
      const webhookId = c.req.param("id");
      const existing = await db.query.pmWebhook.findFirst({
        where: eq(pmWebhook.id, webhookId),
      });
      if (!existing) {
        throw new AppError("WEBHOOK_NOT_FOUND", "Webhook not found", 404);
      }
      await db.delete(pmWebhookDelivery).where(eq(pmWebhookDelivery.webhookId, webhookId));
      await db.delete(pmWebhook).where(eq(pmWebhook.id, webhookId));
      return c.json({ success: true });
    },
  )
  .post(
    "/:id/test",
    requireRole("ADMIN"),
    async (c) => {
      const webhookId = c.req.param("id");
      const webhook = await db.query.pmWebhook.findFirst({
        where: eq(pmWebhook.id, webhookId),
      });
      if (!webhook) {
        throw new AppError("WEBHOOK_NOT_FOUND", "Webhook not found", 404);
      }

      const deliveryId = ulid();
      const timestamp = now();
      const testPayload = { event: "test", timestamp };

      let responseStatus: number | null = null;
      let responseBody: string | null = null;

      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10000),
        });
        responseStatus = res.status;
        responseBody = await res.text().catch(() => null);
      } catch {
        responseStatus = 0;
        responseBody = "Connection failed";
      }

      await db.insert(pmWebhookDelivery).values({
        id: deliveryId,
        webhookId,
        eventType: "test",
        payloadJson: JSON.stringify(testPayload),
        responseStatus,
        responseBody,
        deliveredAt: timestamp,
      });

      return c.json({ deliveryId, responseStatus, responseBody });
    },
  )
  .get(
    "/:id/deliveries",
    requireRole("ADMIN"),
    zValidator("query", listDeliveriesSchema),
    async (c) => {
      const webhookId = c.req.param("id");
      const query = c.req.valid("query");
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const where = eq(pmWebhookDelivery.webhookId, webhookId);

      const [items, countResult] = await Promise.all([
        db.select().from(pmWebhookDelivery).where(where).orderBy(desc(pmWebhookDelivery.deliveredAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pmWebhookDelivery).where(where),
      ]);

      return c.json({ items, total: countResult[0]?.count ?? 0, limit, offset });
    },
  );
