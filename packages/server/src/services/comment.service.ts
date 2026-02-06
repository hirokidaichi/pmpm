import { eq, and, isNull, desc, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import {
  pmComment,
  pmCommentMention,
  pmInboxMessage,
  pmUserProfile,
  pmTask,
  pmTaskAssignee,
} from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateCommentInput {
  taskId: string;
  bodyMd: string;
}

export interface UpdateCommentInput {
  bodyMd: string;
}

export interface ListCommentsQuery {
  taskId: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

const now = () => Date.now();

/** Extract @alias mentions from markdown text */
function extractMentions(bodyMd: string): string[] {
  const mentionRegex = /@([a-z0-9_-]+)/g;
  const aliases: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(bodyMd)) !== null) {
    aliases.push(match[1]);
  }
  return [...new Set(aliases)];
}

/** Resolve alias list to user IDs, excluding a specific user */
async function resolveAliases(aliases: string[], excludeUserId: string): Promise<string[]> {
  if (aliases.length === 0) return [];
  const mentionedUsers = await Promise.all(
    aliases.map((alias) =>
      db.query.pmUserProfile.findFirst({
        where: eq(pmUserProfile.alias, alias),
        columns: { userId: true },
      }),
    ),
  );
  return mentionedUsers
    .filter((u): u is { userId: string } => u !== undefined)
    .map((u) => u.userId)
    .filter((uid) => uid !== excludeUserId);
}

export const commentService = {
  async create(input: CreateCommentInput, userId: string) {
    // Verify task exists
    const task = await db.query.pmTask.findFirst({
      where: and(eq(pmTask.id, input.taskId), isNull(pmTask.deletedAt)),
    });
    if (!task) {
      throw new AppError("TASK_NOT_FOUND", `Task '${input.taskId}' not found`, 404);
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmComment).values({
      id,
      taskId: input.taskId,
      createdBy: userId,
      bodyMd: input.bodyMd,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Parse mentions and create mention records + inbox messages
    const mentionAliases = extractMentions(input.bodyMd);
    const mentionedUserIds = await resolveAliases(mentionAliases, userId);

    if (mentionedUserIds.length > 0) {
      // Insert mention records
      await db.insert(pmCommentMention).values(
        mentionedUserIds.map((uid) => ({
          commentId: id,
          userId: uid,
        })),
      );

      // Create inbox messages for mentioned users
      await db.insert(pmInboxMessage).values(
        mentionedUserIds.map((uid) => ({
          id: ulid(),
          recipientUserId: uid,
          senderUserId: userId,
          messageType: "MENTION" as const,
          title: `You were mentioned in a comment on "${task.title}"`,
          bodyMd: input.bodyMd,
          refEntityType: "comment",
          refEntityId: id,
          createdAt: timestamp,
        })),
      );
    }

    // Notify task assignees about the new comment (excluding author and already-mentioned)
    const mentionedSet = new Set(mentionedUserIds);
    const assignees = await db.query.pmTaskAssignee.findMany({
      where: eq(pmTaskAssignee.taskId, input.taskId),
      columns: { userId: true },
    });

    const assigneeNotifications = assignees
      .filter((a) => a.userId !== userId && !mentionedSet.has(a.userId));

    if (assigneeNotifications.length > 0) {
      await db.insert(pmInboxMessage).values(
        assigneeNotifications.map((a) => ({
          id: ulid(),
          recipientUserId: a.userId,
          senderUserId: userId,
          messageType: "COMMENT" as const,
          title: `New comment on task "${task.title}"`,
          bodyMd: input.bodyMd,
          refEntityType: "comment",
          refEntityId: id,
          createdAt: timestamp,
        })),
      );
    }

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "comment.created",
      entityType: "comment",
      entityId: id,
      payload: { taskId: input.taskId },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const comment = await db.query.pmComment.findFirst({
      where: and(eq(pmComment.id, id), isNull(pmComment.deletedAt)),
      with: { mentions: true },
    });
    if (!comment) {
      throw new AppError("COMMENT_NOT_FOUND", `Comment '${id}' not found`, 404);
    }
    return comment;
  },

  async list(query: ListCommentsQuery) {
    const conditions = [
      eq(pmComment.taskId, query.taskId),
      isNull(pmComment.deletedAt),
    ];

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const orderFn = query.order === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      db.query.pmComment.findMany({
        where,
        orderBy: [orderFn(pmComment.createdAt)],
        limit,
        offset,
        with: { mentions: true },
      }),
      db.select({ count: sql<number>`count(*)` }).from(pmComment).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateCommentInput, userId: string) {
    const comment = await this.getById(id);

    if (comment.createdBy !== userId) {
      throw new AppError("FORBIDDEN", "You can only edit your own comments", 403);
    }

    // Get old mentions before re-processing
    const oldMentions = await db.query.pmCommentMention.findMany({
      where: eq(pmCommentMention.commentId, id),
      columns: { userId: true },
    });
    const oldMentionedUserIds = new Set(oldMentions.map((m) => m.userId));

    await db
      .update(pmComment)
      .set({
        bodyMd: input.bodyMd,
        updatedAt: now(),
      })
      .where(eq(pmComment.id, id));

    // Re-process mentions: remove old, add new
    await db.delete(pmCommentMention).where(eq(pmCommentMention.commentId, id));

    const mentionAliases = extractMentions(input.bodyMd);
    const resolvedUserIds = await resolveAliases(mentionAliases, userId);

    if (resolvedUserIds.length > 0) {
      await db.insert(pmCommentMention).values(
        resolvedUserIds.map((uid) => ({
          commentId: id,
          userId: uid,
        })),
      );

      // Send notifications to newly mentioned users only
      const task = await db.query.pmTask.findFirst({
        where: eq(pmTask.id, comment.taskId),
        columns: { title: true },
      });
      const newlyMentioned = resolvedUserIds.filter((uid) => !oldMentionedUserIds.has(uid));
      if (newlyMentioned.length > 0) {
        const timestamp = now();
        await db.insert(pmInboxMessage).values(
          newlyMentioned.map((uid) => ({
            id: ulid(),
            recipientUserId: uid,
            senderUserId: userId,
            messageType: "MENTION" as const,
            title: `You were mentioned in a comment on "${task?.title ?? "a task"}"`,
            bodyMd: input.bodyMd,
            refEntityType: "comment",
            refEntityId: id,
            createdAt: timestamp,
          })),
        );
      }
    }

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "comment.updated",
      entityType: "comment",
      entityId: id,
      payload: { taskId: comment.taskId },
    });

    return this.getById(id);
  },

  async softDelete(id: string, userId: string) {
    const comment = await this.getById(id);

    if (comment.createdBy !== userId) {
      throw new AppError("FORBIDDEN", "You can only delete your own comments", 403);
    }

    await db
      .update(pmComment)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(pmComment.id, id));

    // Clean up inbox notifications for this comment
    await db.delete(pmInboxMessage).where(
      and(
        eq(pmInboxMessage.refEntityType, "comment"),
        eq(pmInboxMessage.refEntityId, id),
      ),
    );

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "comment.deleted",
      entityType: "comment",
      entityId: id,
      payload: { taskId: comment.taskId },
    });
  },
};
