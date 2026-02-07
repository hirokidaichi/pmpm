import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveWorkspace, requirePermission } from "../middleware/accessControl.js";
import { workspaceService } from "../services/workspace.service.js";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
});

const listWorkspacesSchema = z.object({
  search: z.string().optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["name", "created_at", "updated_at"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const workspaceRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listWorkspacesSchema),
    async (c) => {
      const query = c.req.valid("query");
      const membership = c.get("membership");
      const user = c.get("user")!;
      // Server ADMIN sees all; others see only their workspaces
      if (membership?.role === "ADMIN") {
        const result = await workspaceService.list(query);
        return c.json(result);
      }
      const result = await workspaceService.listForUser(query, user.id);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    resolveWorkspace({ from: "param", key: "id" }),
    requirePermission("read"),
    async (c) => {
      const workspace = await workspaceService.getById(c.req.param("id"));
      return c.json(workspace);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createWorkspaceSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const workspace = await workspaceService.create(input, user.id);
      return c.json(workspace, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    resolveWorkspace({ from: "param", key: "id" }),
    requirePermission("manage"),
    zValidator("json", updateWorkspaceSchema),
    async (c) => {
      const input = c.req.valid("json");
      const workspace = await workspaceService.update(c.req.param("id"), input);
      return c.json(workspace);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    resolveWorkspace({ from: "param", key: "id" }),
    requirePermission("manage"),
    async (c) => {
      const workspace = await workspaceService.archive(c.req.param("id"));
      return c.json(workspace);
    },
  );
