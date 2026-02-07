import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { riskService } from "../services/risk.service.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500),
  descriptionMd: z.string().max(10000).optional(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["IDENTIFIED", "MITIGATING", "MITIGATED", "OCCURRED", "ACCEPTED"]).optional(),
  mitigationPlan: z.string().max(10000).optional(),
  ownerUserId: z.string().optional(),
  dueAt: z.number().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionMd: z.string().max(10000).nullish(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["IDENTIFIED", "MITIGATING", "MITIGATED", "OCCURRED", "ACCEPTED"]).optional(),
  mitigationPlan: z.string().max(10000).nullish(),
  ownerUserId: z.string().nullish(),
  dueAt: z.number().nullish(),
});

const listSchema = z.object({
  projectId: z.string().min(1),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const riskRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listSchema),
    resolveProject({ from: "query", key: "projectId" }),
    requirePermission("read"),
    async (c) => {
      const query = c.req.valid("query");
      const result = await riskService.list(query);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const risk = await riskService.getById(c.req.param("id"));
      return c.json(risk);
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createSchema),
    resolveProject({ from: "body", key: "projectId" }),
    requirePermission("write"),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const risk = await riskService.create(input, user.id);
      return c.json(risk, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateSchema),
    async (c) => {
      const input = c.req.valid("json");
      const risk = await riskService.update(c.req.param("id"), input);
      return c.json(risk);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      await riskService.delete(c.req.param("id"));
      return c.body(null, 204);
    },
  );
