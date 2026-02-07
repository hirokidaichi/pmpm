import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { db } from "../db/client.js";
import { pmDependency } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

async function detectCycle(newPredecessorId: string, newSuccessorId: string): Promise<boolean> {
  // Check if adding newPredecessor→newSuccessor would create a cycle
  // by seeing if we can reach newPredecessor from newSuccessor via existing edges
  const visited = new Set<string>();
  const queue = [newSuccessorId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newPredecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    // Find all tasks that depend on 'current' (current is predecessor)
    const deps = await db.query.pmDependency.findMany({
      where: eq(pmDependency.predecessorTaskId, current),
      columns: { successorTaskId: true },
    });
    for (const dep of deps) {
      queue.push(dep.successorTaskId);
    }
  }
  return false;
}

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
    resolveProject({ from: "task", paramKey: "predecessorTaskId" }),
    requirePermission("write"),
    async (c) => {
      const input = c.req.valid("json");

      if (input.predecessorTaskId === input.successorTaskId) {
        throw new AppError("INVALID_DEPENDENCY", "A task cannot depend on itself", 422);
      }

      const hasCycle = await detectCycle(input.predecessorTaskId, input.successorTaskId);
      if (hasCycle) {
        throw new AppError("CIRCULAR_DEPENDENCY", "Adding this dependency would create a circular reference", 422);
      }

      const id = ulid();
      const timestamp = now();

      try {
        await db.insert(pmDependency).values({
          id,
          predecessorTaskId: input.predecessorTaskId,
          successorTaskId: input.successorTaskId,
          depType: input.depType,
          lagMinutes: input.lagMinutes,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } catch (err: any) {
        if (
          err.message?.includes("UNIQUE constraint failed") ||
          err.cause?.message?.includes("UNIQUE constraint failed")
        ) {
          throw new AppError("DUPLICATE_DEPENDENCY", "This dependency already exists", 409);
        }
        throw err;
      }

      return c.json(
        await db.query.pmDependency.findFirst({ where: eq(pmDependency.id, id) }),
        201,
      );
    },
  )
  .get(
    "/task/:taskId",
    requireRole("STAKEHOLDER"),
    resolveProject({ from: "task", paramKey: "taskId" }),
    requirePermission("read"),
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
