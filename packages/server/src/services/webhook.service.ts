import { eq, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmWebhook, pmWebhookDelivery } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { createHmac } from "node:crypto";

const now = () => Date.now();

export interface CreateWebhookInput {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  isActive?: boolean;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  secret?: string | null;
  events?: string[];
  isActive?: boolean;
}

export const webhookService = {
  async create(input: CreateWebhookInput, userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmWebhook).values({
      id,
      name: input.name,
      url: input.url,
      secret: input.secret,
      eventsJson: JSON.stringify(input.events),
      isActive: input.isActive === false ? 0 : 1,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const webhook = await db.query.pmWebhook.findFirst({
      where: eq(pmWebhook.id, id),
    });
    if (!webhook) {
      throw new AppError("WEBHOOK_NOT_FOUND", `Webhook '${id}' not found`, 404);
    }
    return webhook;
  },

  async list() {
    return db.query.pmWebhook.findMany({
      orderBy: [desc(pmWebhook.createdAt)],
    });
  },

  async update(id: string, input: UpdateWebhookInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.secret !== undefined) updateData.secret = input.secret;
    if (input.events !== undefined) updateData.eventsJson = JSON.stringify(input.events);
    if (input.isActive !== undefined) updateData.isActive = input.isActive ? 1 : 0;

    await db.update(pmWebhook).set(updateData).where(eq(pmWebhook.id, id));
    return this.getById(id);
  },

  async delete(id: string) {
    await this.getById(id);
    await db.delete(pmWebhook).where(eq(pmWebhook.id, id));
  },

  async deliver(eventType: string, payload: unknown) {
    // Find all active webhooks that match this event type
    const webhooks = await db.query.pmWebhook.findMany({
      where: eq(pmWebhook.isActive, 1),
    });

    const matchingWebhooks = webhooks.filter((wh) => {
      const events: string[] = JSON.parse(wh.eventsJson);
      return events.includes(eventType) || events.includes("*");
    });

    const results = await Promise.allSettled(
      matchingWebhooks.map((wh) => this.deliverToWebhook(wh, eventType, payload)),
    );

    return results.length;
  },

  async deliverToWebhook(
    webhook: { id: string; url: string; secret: string | null },
    eventType: string,
    payload: unknown,
  ) {
    const body = JSON.stringify({ event: eventType, payload, timestamp: now() });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": eventType,
    };

    // HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const deliveryId = ulid();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = response.status;
      responseBody = await response.text().catch(() => null);
    } catch (err) {
      responseStatus = 0;
      responseBody = err instanceof Error ? err.message : "Unknown error";
    }

    // Record delivery
    await db.insert(pmWebhookDelivery).values({
      id: deliveryId,
      webhookId: webhook.id,
      eventType,
      payloadJson: body,
      responseStatus,
      responseBody,
      deliveredAt: now(),
    });
  },

  async listDeliveries(webhookId: string, limit = 50, offset = 0) {
    await this.getById(webhookId);

    const [items, countResult] = await Promise.all([
      db.select().from(pmWebhookDelivery)
        .where(eq(pmWebhookDelivery.webhookId, webhookId))
        .orderBy(desc(pmWebhookDelivery.deliveredAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(pmWebhookDelivery)
        .where(eq(pmWebhookDelivery.webhookId, webhookId)),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async testDelivery(webhookId: string) {
    const webhook = await this.getById(webhookId);
    await this.deliverToWebhook(
      webhook,
      "webhook.test",
      { message: "This is a test delivery" },
    );
  },
};
