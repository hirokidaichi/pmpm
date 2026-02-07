import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { ccpmService } from "../services/ccpm.service.js";
import { bufferService } from "../services/buffer.service.js";

const forecastSchema = z.object({
  simulations: z.coerce.number().int().min(100).max(10000).optional(),
});

const listBuffersSchema = z.object({
  projectId: z.string().min(1),
  bufferType: z.enum(["PROJECT", "FEEDING"]).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const updateBufferSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  consumedMinutes: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export const ccpmRoutes = new Hono<AppEnv>()
  // Critical chain analysis (read-only)
  .get(
    "/projects/:projectId/critical-chain",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const projectId = c.req.param("projectId");
      const result = await ccpmService.analyzeCriticalChain(projectId);
      return c.json(result);
    },
  )
  // Project completion forecast (Monte Carlo simulation)
  .get(
    "/projects/:projectId/forecast",
    requireRole("STAKEHOLDER"),
    zValidator("query", forecastSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const { simulations } = c.req.valid("query");
      const result = await ccpmService.forecast(projectId, simulations ?? 1000);
      return c.json(result);
    },
  )
  // Regenerate buffers for a project
  .post(
    "/projects/:projectId/buffers/regenerate",
    requireRole("MEMBER"),
    async (c) => {
      const projectId = c.req.param("projectId");
      const user = c.get("user")!;
      const result = await bufferService.regenerate(projectId, user.id);
      return c.json(result, 201);
    },
  )
  // Buffer consumption status with zones
  .get(
    "/projects/:projectId/buffer-status",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const projectId = c.req.param("projectId");
      const result = await bufferService.getProjectBufferStatus(projectId);
      return c.json(result);
    },
  )
  // List buffers
  .get(
    "/buffers",
    requireRole("STAKEHOLDER"),
    zValidator("query", listBuffersSchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await bufferService.list(query);
      return c.json(result);
    },
  )
  // Get single buffer
  .get(
    "/buffers/:id",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const buffer = await bufferService.getById(c.req.param("id"));
      return c.json(buffer);
    },
  )
  // Update buffer (consumption tracking)
  .put(
    "/buffers/:id",
    requireRole("MEMBER"),
    zValidator("json", updateBufferSchema),
    async (c) => {
      const input = c.req.valid("json");
      const buffer = await bufferService.update(c.req.param("id"), input);
      return c.json(buffer);
    },
  )
  // Delete buffer
  .delete(
    "/buffers/:id",
    requireRole("MEMBER"),
    async (c) => {
      await bufferService.delete(c.req.param("id"));
      return c.json({ success: true });
    },
  );
