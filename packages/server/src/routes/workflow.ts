import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { workflowService } from "../services/workflow.service.js";

const createWorkflowSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
  stages: z.array(z.object({
    name: z.string().min(1).max(100),
    category: z.enum(["ACTIVE", "COMPLETED", "DEFERRED", "CANCELLED"]),
    color: z.string().max(7).optional(),
  })).optional(),
});

const addStageSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(["ACTIVE", "COMPLETED", "DEFERRED", "CANCELLED"]),
  position: z.number().int().min(0).optional(),
  color: z.string().max(7).optional(),
});

const updateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(["ACTIVE", "COMPLETED", "DEFERRED", "CANCELLED"]).optional(),
  position: z.number().int().min(0).optional(),
  color: z.string().max(7).optional(),
});

export const workflowRoutes = new Hono<AppEnv>()
  .get(
    "/project/:projectId",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "param", key: "projectId" }),
    requirePermission("read"),
    async (c) => {
      const workflows = await workflowService.listByProject(c.req.param("projectId"));
      return c.json(workflows);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const workflow = await workflowService.getById(c.req.param("id"));
      return c.json(workflow);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createWorkflowSchema),
    resolveProject({ from: "body", key: "projectId" }),
    requirePermission("write"),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const workflow = await workflowService.create(input, user.id);
      return c.json(workflow, 201);
    },
  )
  .post(
    "/:id/stages",
    requireRole("MEMBER"),
    zValidator("json", addStageSchema),
    async (c) => {
      const input = c.req.valid("json");
      const workflow = await workflowService.addStage(c.req.param("id"), input);
      return c.json(workflow, 201);
    },
  )
  .put(
    "/stages/:stageId",
    requireRole("MEMBER"),
    zValidator("json", updateStageSchema),
    async (c) => {
      const input = c.req.valid("json");
      const workflow = await workflowService.updateStage(c.req.param("stageId"), input);
      return c.json(workflow);
    },
  )
  .delete(
    "/stages/:stageId",
    requireRole("MEMBER"),
    async (c) => {
      const workflow = await workflowService.deleteStage(c.req.param("stageId"));
      return c.json(workflow);
    },
  )
  .delete(
    "/:id",
    requireRole("ADMIN"),
    async (c) => {
      await workflowService.delete(c.req.param("id"));
      return c.json({ success: true });
    },
  );
