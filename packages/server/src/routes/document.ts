import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { db } from "../db/client.js";
import { pmDocument } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  contentType: z.enum(["MARKDOWN", "IMAGE", "SVG", "OTHER"]),
  bodyMd: z.string().max(200000).optional(),
  parentDocumentId: z.string().optional(),
  position: z.number().int().optional(),
  storageProvider: z.string().optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  bodyMd: z.string().max(200000).optional(),
  parentDocumentId: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

const listDocumentsSchema = z.object({
  parentDocumentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const documentRoutes = new Hono<AppEnv>()
  .get(
    "/:projectId/documents",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("read"),
    zValidator("query", listDocumentsSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const query = c.req.valid("query");

      const conditions = [
        eq(pmDocument.projectId, projectId),
        isNull(pmDocument.deletedAt),
      ];

      if (query.parentDocumentId) {
        conditions.push(eq(pmDocument.parentDocumentId, query.parentDocumentId));
      }

      const where = and(...conditions);
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const [items, countResult] = await Promise.all([
        db.select().from(pmDocument).where(where).orderBy(asc(pmDocument.position)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pmDocument).where(where),
      ]);

      return c.json({ items, total: countResult[0]?.count ?? 0, limit, offset });
    },
  )
  .get(
    "/:projectId/documents/tree",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("read"),
    async (c) => {
      const projectId = c.req.param("projectId");
      const allDocs = await db.select().from(pmDocument).where(
        and(
          eq(pmDocument.projectId, projectId),
          isNull(pmDocument.deletedAt),
        ),
      ).orderBy(asc(pmDocument.position));

      // Build tree
      type DocNode = typeof allDocs[number] & { children: DocNode[] };
      const byId = new Map<string, DocNode>();
      const roots: DocNode[] = [];

      for (const doc of allDocs) {
        byId.set(doc.id, { ...doc, children: [] });
      }
      for (const node of byId.values()) {
        if (node.parentDocumentId && byId.has(node.parentDocumentId)) {
          byId.get(node.parentDocumentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      return c.json(roots);
    },
  )
  .get(
    "/:projectId/documents/:id",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("read"),
    async (c) => {
      const doc = await db.query.pmDocument.findFirst({
        where: and(
          eq(pmDocument.id, c.req.param("id")),
          isNull(pmDocument.deletedAt),
        ),
      });
      if (!doc) {
        throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
      }
      return c.json(doc);
    },
  )
  .post(
    "/:projectId/documents",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("write"),
    zValidator("json", createDocumentSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const id = ulid();
      const timestamp = now();

      await db.insert(pmDocument).values({
        id,
        projectId,
        parentDocumentId: input.parentDocumentId,
        title: input.title,
        contentType: input.contentType,
        bodyMd: input.bodyMd,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        position: input.position ?? 0,
        createdBy: user.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return c.json(
        await db.query.pmDocument.findFirst({ where: eq(pmDocument.id, id) }),
        201,
      );
    },
  )
  .put(
    "/:projectId/documents/:id",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("write"),
    zValidator("json", updateDocumentSchema),
    async (c) => {
      const docId = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.pmDocument.findFirst({
        where: and(eq(pmDocument.id, docId), isNull(pmDocument.deletedAt)),
      });
      if (!existing) {
        throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
      }

      const updateData: Record<string, unknown> = { updatedAt: now() };
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db.update(pmDocument).set(updateData).where(eq(pmDocument.id, docId));
      return c.json(
        await db.query.pmDocument.findFirst({ where: eq(pmDocument.id, docId) }),
      );
    },
  )
  .delete(
    "/:projectId/documents/:id",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("write"),
    async (c) => {
      const docId = c.req.param("id");
      const existing = await db.query.pmDocument.findFirst({
        where: and(eq(pmDocument.id, docId), isNull(pmDocument.deletedAt)),
      });
      if (!existing) {
        throw new AppError("DOCUMENT_NOT_FOUND", "Document not found", 404);
      }

      await db.update(pmDocument).set({ deletedAt: now(), updatedAt: now() }).where(eq(pmDocument.id, docId));
      return c.json({ success: true });
    },
  );
