import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, resolveWorkspace, requirePermission } from "../middleware/accessControl.js";
import { projectService } from "../services/project.service.js";

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  key: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/),
  description: z.string().max(2000).optional(),
  ownerUserId: z.string().optional(),
  startAt: z.number().optional(),
  dueAt: z.number().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  key: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/).optional(),
  description: z.string().max(2000).optional(),
  descriptionMd: z.string().max(50000).optional(),
  ownerUserId: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  startAt: z.number().optional(),
  dueAt: z.number().optional(),
  defaultWorkflowId: z.string().optional(),
});

const listProjectsSchema = z.object({
  workspaceId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["name", "created_at", "updated_at"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["LEAD", "MEMBER", "REVIEWER", "STAKEHOLDER"]),
  title: z.string().max(100).optional(),
  reportsToUserId: z.string().optional(),
});

export const projectRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listProjectsSchema),
    async (c) => {
      const query = c.req.valid("query");
      const membership = c.get("membership");
      const user = c.get("user")!;
      if (membership?.role === "ADMIN") {
        const result = await projectService.list(query);
        return c.json(result);
      }
      const result = await projectService.listForUser(query, user.id);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("read"),
    async (c) => {
      const project = await projectService.getById(c.req.param("id"));
      return c.json(project);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createProjectSchema),
    resolveWorkspace({ from: "body", key: "workspaceId" }),
    requirePermission("write"),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const project = await projectService.create(input, user.id);
      return c.json(project, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("manage"),
    zValidator("json", updateProjectSchema),
    async (c) => {
      const input = c.req.valid("json");
      const project = await projectService.update(c.req.param("id"), input);
      return c.json(project);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("manage"),
    async (c) => {
      const project = await projectService.archive(c.req.param("id"));
      return c.json(project);
    },
  )
  .post(
    "/:id/members",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("manage"),
    zValidator("json", addMemberSchema),
    async (c) => {
      const input = c.req.valid("json");
      const project = await projectService.addMember(c.req.param("id"), input);
      return c.json(project, 201);
    },
  )
  .delete(
    "/:id/members/:userId",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("manage"),
    async (c) => {
      const project = await projectService.removeMember(
        c.req.param("id"),
        c.req.param("userId"),
      );
      return c.json(project);
    },
  )
  .get(
    "/:id/description",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("read"),
    async (c) => {
      const project = await projectService.getById(c.req.param("id"));
      return c.json({ descriptionMd: project.descriptionMd ?? "" });
    },
  )
  .put(
    "/:id/description",
    requireRole("MEMBER"),
    resolveProject({ from: "param", key: "id" }),
    requirePermission("write"),
    zValidator("json", z.object({ descriptionMd: z.string().max(50000) })),
    async (c) => {
      const { descriptionMd } = c.req.valid("json");
      const project = await projectService.update(c.req.param("id"), { descriptionMd });
      return c.json({ descriptionMd: project.descriptionMd ?? "" });
    },
  );
