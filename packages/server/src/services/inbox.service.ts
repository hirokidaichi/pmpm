import { eq, and, desc, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmInboxMessage, pmUserProfile } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

export interface ListInboxQuery {
  unreadOnly?: boolean;
  messageType?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export const inboxService = {
  async sendDirectMessage(input: {
    senderUserId: string;
    recipientAlias: string;
    title: string;
    bodyMd?: string;
    refEntityType?: string;
    refEntityId?: string;
  }) {
    // Resolve alias to userId
    const recipient = await db.query.pmUserProfile.findFirst({
      where: eq(pmUserProfile.alias, input.recipientAlias),
      columns: { userId: true },
    });
    if (!recipient) {
      throw new AppError("USER_NOT_FOUND", `User with alias '@${input.recipientAlias}' not found`, 404);
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmInboxMessage).values({
      id,
      recipientUserId: recipient.userId,
      senderUserId: input.senderUserId,
      messageType: "DIRECT_MESSAGE",
      title: input.title,
      bodyMd: input.bodyMd,
      refEntityType: input.refEntityType,
      refEntityId: input.refEntityId,
      createdAt: timestamp,
    });

    return db.query.pmInboxMessage.findFirst({
      where: eq(pmInboxMessage.id, id),
    });
  },

  async sendSystemNotification(input: {
    recipientUserId: string;
    messageType: "MENTION" | "ASSIGNMENT" | "STATUS_CHANGE" | "COMMENT" | "REMINDER" | "SYSTEM";
    title: string;
    bodyMd?: string;
    refEntityType?: string;
    refEntityId?: string;
  }) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmInboxMessage).values({
      id,
      recipientUserId: input.recipientUserId,
      senderUserId: null,
      messageType: input.messageType,
      title: input.title,
      bodyMd: input.bodyMd,
      refEntityType: input.refEntityType,
      refEntityId: input.refEntityId,
      createdAt: timestamp,
    });

    return db.query.pmInboxMessage.findFirst({
      where: eq(pmInboxMessage.id, id),
    });
  },

  async list(userId: string, query: ListInboxQuery) {
    const conditions = [eq(pmInboxMessage.recipientUserId, userId)];

    if (query.unreadOnly) {
      conditions.push(eq(pmInboxMessage.isRead, 0));
    }
    if (query.messageType) {
      conditions.push(eq(pmInboxMessage.messageType, query.messageType as "SYSTEM"));
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const orderFn = query.order === "asc" ? asc : desc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmInboxMessage).where(where).orderBy(orderFn(pmInboxMessage.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmInboxMessage).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async countUnread(userId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(pmInboxMessage)
      .where(and(eq(pmInboxMessage.recipientUserId, userId), eq(pmInboxMessage.isRead, 0)));

    return result[0]?.count ?? 0;
  },

  async markRead(messageId: string, userId: string) {
    const message = await db.query.pmInboxMessage.findFirst({
      where: eq(pmInboxMessage.id, messageId),
    });
    if (!message) {
      throw new AppError("INBOX_MESSAGE_NOT_FOUND", `Message '${messageId}' not found`, 404);
    }
    if (message.recipientUserId !== userId) {
      throw new AppError("FORBIDDEN", "You can only mark your own messages as read", 403);
    }

    await db
      .update(pmInboxMessage)
      .set({ isRead: 1, readAt: now() })
      .where(eq(pmInboxMessage.id, messageId));
  },

  async markAllRead(userId: string) {
    await db
      .update(pmInboxMessage)
      .set({ isRead: 1, readAt: now() })
      .where(and(eq(pmInboxMessage.recipientUserId, userId), eq(pmInboxMessage.isRead, 0)));
  },
};
