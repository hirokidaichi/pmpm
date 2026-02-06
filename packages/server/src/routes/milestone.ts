import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { milestoneService } from "../services/milestone.service.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.number().optional(),
  status: z.enum(["OPEN", "COMPLETED", "MISSED"]).optional(),
  position: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  dueAt: z.number().nullish(),
  status: z.enum(["OPEN", "COMPLETED", "MISSED"]).optional(),
  position: z.number().int().min(0).optional(),
});

const listSchema = z.object({
  projectId: z.string().min(1),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const milestoneRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listSchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await milestoneService.list(query);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const milestone = await milestoneService.getById(c.req.param("id"));
      return c.json(milestone);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const milestone = await milestoneService.create(input, user.id);
      return c.json(milestone, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateSchema),
    async (c) => {
      const input = c.req.valid("json");
      const milestone = await milestoneService.update(c.req.param("id"), input);
      return c.json(milestone);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      await milestoneService.delete(c.req.param("id"));
      return c.body(null, 204);
    },
  );
