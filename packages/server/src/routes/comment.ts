import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { commentService } from "../services/comment.service.js";

const createCommentSchema = z.object({
  bodyMd: z.string().min(1).max(50000),
});

const updateCommentSchema = z.object({
  bodyMd: z.string().min(1).max(50000),
});

const listCommentsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const commentRoutes = new Hono<AppEnv>()
  .get(
    "/:taskId/comments",
    requireRole("STAKEHOLDER"),
    zValidator("query", listCommentsSchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await commentService.list({
        taskId: c.req.param("taskId"),
        ...query,
      });
      return c.json(result);
    },
  )
  .post(
    "/:taskId/comments",
    requireRole("STAKEHOLDER"),
    zValidator("json", createCommentSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const comment = await commentService.create(
        { taskId: c.req.param("taskId"), ...input },
        user.id,
      );
      return c.json(comment, 201);
    },
  )
  .put(
    "/:taskId/comments/:id",
    requireRole("STAKEHOLDER"),
    zValidator("json", updateCommentSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const comment = await commentService.update(c.req.param("id"), input, user.id);
      return c.json(comment);
    },
  )
  .delete(
    "/:taskId/comments/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const user = c.get("user")!;
      await commentService.softDelete(c.req.param("id"), user.id);
      return c.json({ success: true });
    },
  );
