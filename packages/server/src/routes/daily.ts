import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { dailyService } from "../services/daily.service.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  projectId: z.string().optional(),
  reportDate: z.string().regex(datePattern, "Must be YYYY-MM-DD"),
  autoSummaryJson: z.string().optional(),
  bodyMd: z.string().max(50000).optional(),
  achievements: z.string().max(10000).optional(),
  plans: z.string().max(10000).optional(),
  issues: z.string().max(10000).optional(),
});

const updateSchema = z.object({
  autoSummaryJson: z.string().nullish(),
  bodyMd: z.string().max(50000).nullish(),
  achievements: z.string().max(10000).nullish(),
  plans: z.string().max(10000).nullish(),
  issues: z.string().max(10000).nullish(),
});

const listSchema = z.object({
  userId: z.string().optional(),
  projectId: z.string().optional(),
  dateFrom: z.string().regex(datePattern).optional(),
  dateTo: z.string().regex(datePattern).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const previewSchema = z.object({
  reportDate: z.string().regex(datePattern, "Must be YYYY-MM-DD"),
  projectId: z.string().optional(),
});

export const dailyRoutes = new Hono<AppEnv>()
  .get(
    "/preview",
    requireRole("STAKEHOLDER"),
    zValidator("query", previewSchema),
    resolveProject({ from: "query", key: "projectId" }),
    requirePermission("read", { skipIfNoContext: true }),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const preview = await dailyService.preview(
        user.id,
        query.reportDate,
        query.projectId,
      );
      return c.json(preview);
    },
  )
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listSchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await dailyService.list(query);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const report = await dailyService.getById(c.req.param("id"));
      return c.json(report);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createSchema),
    resolveProject({ from: "body", key: "projectId" }),
    requirePermission("write", { skipIfNoContext: true }),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const result = await dailyService.create(input, user.id);
      const { isNew, ...report } = result;
      return c.json(report, isNew ? 201 : 200);
    },
  )
  .patch(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateSchema),
    async (c) => {
      const input = c.req.valid("json");
      const report = await dailyService.update(c.req.param("id"), input);
      return c.json(report);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      await dailyService.delete(c.req.param("id"));
      return c.body(null, 204);
    },
  );
