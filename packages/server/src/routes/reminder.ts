import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { reminderService } from "../services/reminder.service.js";

const createSchema = z.object({
  targetUserId: z.string().optional(),
  title: z.string().min(1).max(500),
  bodyMd: z.string().max(10000).optional(),
  refEntityType: z.string().max(50).optional(),
  refEntityId: z.string().max(100).optional(),
  taskId: z.string().optional(),
  remindAt: z.number().int(),
  repeatType: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  repeatEndAt: z.number().int().optional(),
}).refine(
  (data) => data.remindAt > Date.now() - 60000,
  { message: "remindAt must be in the future", path: ["remindAt"] }
);

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  bodyMd: z.string().max(10000).nullish(),
  refEntityType: z.string().max(50).nullish(),
  refEntityId: z.string().max(100).nullish(),
  remindAt: z.number().int().optional(),
  repeatType: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  repeatEndAt: z.number().int().nullish(),
});

const listSchema = z.object({
  status: z.enum(["PENDING", "SENT", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const reminderRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listSchema),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const result = await reminderService.list({
        userId: user.id,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const reminder = await reminderService.getById(c.req.param("id"));
      return c.json(reminder);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createSchema),
    async (c) => {
      const validatedInput = c.req.valid("json");
      const user = c.get("user")!;
      // Map taskId convenience field to refEntityType/refEntityId
      const input = {
        ...validatedInput,
        refEntityType: validatedInput.refEntityType ?? (validatedInput.taskId ? "TASK" : undefined),
        refEntityId: validatedInput.refEntityId ?? validatedInput.taskId,
      };
      const reminder = await reminderService.create(input, user.id);
      return c.json(reminder, 201);
    },
  )
  .patch(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateSchema),
    async (c) => {
      const input = c.req.valid("json");
      const reminder = await reminderService.update(c.req.param("id"), input);
      return c.json(reminder);
    },
  )
  .post(
    "/:id/cancel",
    requireRole("MEMBER"),
    async (c) => {
      const reminder = await reminderService.cancel(c.req.param("id"));
      return c.json(reminder);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      await reminderService.delete(c.req.param("id"));
      return c.body(null, 204);
    },
  );
