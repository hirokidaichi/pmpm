import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import { pmDependency } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const createDependencySchema = z.object({
  predecessorTaskId: z.string().min(1),
  successorTaskId: z.string().min(1),
  depType: z.enum(["FS", "SS", "FF", "SF"]),
  lagMinutes: z.number().int().default(0),
});

export const dependencyRoutes = new Hono<AppEnv>()
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createDependencySchema),
    async (c) => {
      const input = c.req.valid("json");

      if (input.predecessorTaskId === input.successorTaskId) {
        throw new AppError("INVALID_DEPENDENCY", "A task cannot depend on itself", 422);
      }

      const id = ulid();
      const timestamp = now();

      await db.insert(pmDependency).values({
        id,
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        depType: input.depType,
        lagMinutes: input.lagMinutes,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return c.json(
        await db.query.pmDependency.findFirst({ where: eq(pmDependency.id, id) }),
        201,
      );
    },
  )
  .get(
    "/task/:taskId",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const taskId = c.req.param("taskId");
      const deps = await db.query.pmDependency.findMany({
        where: or(
          eq(pmDependency.predecessorTaskId, taskId),
          eq(pmDependency.successorTaskId, taskId),
        ),
      });
      return c.json(deps);
    },
  )
  .delete(
    "/:id",
    requireRole("MEMBER"),
    async (c) => {
      const dep = await db.query.pmDependency.findFirst({
        where: eq(pmDependency.id, c.req.param("id")),
      });
      if (!dep) {
        throw new AppError("DEPENDENCY_NOT_FOUND", "Dependency not found", 404);
      }
      await db.delete(pmDependency).where(eq(pmDependency.id, c.req.param("id")));
      return c.json({ success: true });
    },
  );
