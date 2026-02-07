import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { taskService } from "../services/task.service.js";

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().optional(),
  title: z.string().min(1).max(500),
  descriptionMd: z.string().max(50000).optional(),
  stageId: z.string().optional(),
  importance: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  startAt: z.number().optional(),
  dueAt: z.number().optional(),
  effortMinutes: z.number().int().min(0).optional(),
  optimisticMinutes: z.number().int().min(0).optional(),
  pessimisticMinutes: z.number().int().min(0).optional(),
  storyPoints: z.number().min(0).optional(),
  position: z.number().int().optional(),
  assignees: z
    .array(
      z.object({
        userId: z.string().min(1),
        role: z.enum(["ASSIGNEE", "REVIEWER"]).optional(),
      }),
    )
    .optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionMd: z.string().max(50000).optional(),
  stageId: z.string().nullable().optional(),
  importance: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  startAt: z.number().nullable().optional(),
  dueAt: z.number().nullable().optional(),
  effortMinutes: z.number().int().min(0).nullable().optional(),
  optimisticMinutes: z.number().int().min(0).nullable().optional(),
  pessimisticMinutes: z.number().int().min(0).nullable().optional(),
  storyPoints: z.number().min(0).nullable().optional(),
  position: z.number().int().optional(),
  parentTaskId: z.string().nullable().optional(),
});

const listTasksSchema = z.object({
  projectId: z.string().optional(),
  parentTaskId: z.string().nullable().optional(),
  stageId: z.string().optional(),
  importance: z.string().optional(),
  assigneeUserId: z.string().optional(),
  search: z.string().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["title", "created_at", "updated_at", "position", "due_at", "importance"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const assigneeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ASSIGNEE", "REVIEWER"]).optional(),
});

export const taskRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listTasksSchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await taskService.list(query);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const task = await taskService.getById(c.req.param("id"));
      return c.json(task);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createTaskSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const task = await taskService.create(input, user.id);
      return c.json(task, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateTaskSchema),
    async (c) => {
      const input = c.req.valid("json");
      const task = await taskService.update(c.req.param("id"), input);
      return c.json(task);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      await taskService.softDelete(c.req.param("id"));
      return c.json({ success: true });
    },
  )
  .post(
    "/:id/assignees",
    requireRole("MEMBER"),
    zValidator("json", assigneeSchema),
    async (c) => {
      const { userId, role } = c.req.valid("json");
      const task = await taskService.addAssignee(c.req.param("id"), userId, role);
      return c.json(task, 201);
    },
  )
  .delete(
    "/:id/assignees/:userId",
    requireRole("MEMBER"),
    async (c) => {
      const task = await taskService.removeAssignee(
        c.req.param("id"),
        c.req.param("userId"),
      );
      return c.json(task);
    },
  );
