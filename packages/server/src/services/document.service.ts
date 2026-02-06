import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmDocument, pmProject } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

const now = () => Date.now();

export interface CreateDocumentInput {
  projectId: string;
  parentDocumentId?: string;
  title: string;
  contentType: "MARKDOWN" | "IMAGE" | "SVG" | "OTHER";
  bodyMd?: string;
  storageProvider?: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  position?: number;
}

export interface UpdateDocumentInput {
  title?: string;
  bodyMd?: string;
  parentDocumentId?: string | null;
  position?: number;
}

export interface ListDocumentsQuery {
  projectId: string;
  parentDocumentId?: string | null;
  limit?: number;
  offset?: number;
}

export const documentService = {
  async create(input: CreateDocumentInput, userId: string) {
    // Verify project exists
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, input.projectId),
      columns: { id: true },
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project '${input.projectId}' not found`, 404);
    }

    // Verify parent document exists if specified
    if (input.parentDocumentId) {
      const parent = await db.query.pmDocument.findFirst({
        where: and(eq(pmDocument.id, input.parentDocumentId), isNull(pmDocument.deletedAt)),
        columns: { id: true },
      });
      if (!parent) {
        throw new AppError("DOCUMENT_NOT_FOUND", `Parent document '${input.parentDocumentId}' not found`, 404);
      }
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmDocument).values({
      id,
      projectId: input.projectId,
      parentDocumentId: input.parentDocumentId,
      title: input.title,
      contentType: input.contentType,
      bodyMd: input.bodyMd,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      position: input.position ?? 0,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "document.created",
      entityType: "document",
      entityId: id,
      payload: { title: input.title, projectId: input.projectId },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const doc = await db.query.pmDocument.findFirst({
      where: and(eq(pmDocument.id, id), isNull(pmDocument.deletedAt)),
    });
    if (!doc) {
      throw new AppError("DOCUMENT_NOT_FOUND", `Document '${id}' not found`, 404);
    }
    return doc;
  },

  async list(query: ListDocumentsQuery) {
    const conditions = [
      eq(pmDocument.projectId, query.projectId),
      isNull(pmDocument.deletedAt),
    ];

    if (query.parentDocumentId !== undefined) {
      if (query.parentDocumentId === null) {
        conditions.push(isNull(pmDocument.parentDocumentId));
      } else {
        conditions.push(eq(pmDocument.parentDocumentId, query.parentDocumentId));
      }
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db.query.pmDocument.findMany({
        where,
        orderBy: [asc(pmDocument.position)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(pmDocument).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateDocumentInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    await db.update(pmDocument).set(updateData).where(eq(pmDocument.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "document.updated",
      entityType: "document",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async softDelete(id: string, userId?: string) {
    await this.getById(id);
    await db
      .update(pmDocument)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(pmDocument.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "document.deleted",
      entityType: "document",
      entityId: id,
      payload: {},
    });
  },

  async getTree(projectId: string) {
    const allDocs = await db.query.pmDocument.findMany({
      where: and(
        eq(pmDocument.projectId, projectId),
        isNull(pmDocument.deletedAt),
      ),
      orderBy: [asc(pmDocument.position)],
    });

    type DocNode = (typeof allDocs)[number] & { children: DocNode[] };

    const byId = new Map(allDocs.map((d) => [d.id, { ...d, children: [] as DocNode[] }]));
    const roots: DocNode[] = [];

    for (const doc of byId.values()) {
      if (!doc.parentDocumentId || !byId.has(doc.parentDocumentId)) {
        roots.push(doc);
      } else {
        byId.get(doc.parentDocumentId)!.children.push(doc);
      }
    }

    return roots;
  },
};
