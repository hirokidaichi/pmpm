import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmDependency, pmTask } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

const now = () => Date.now();

export const dependencyService = {
  async create(input: {
    predecessorTaskId: string;
    successorTaskId: string;
    depType?: "FS" | "SS" | "FF" | "SF";
    lagMinutes?: number;
  }) {
    const { predecessorTaskId, successorTaskId } = input;

    if (predecessorTaskId === successorTaskId) {
      throw new AppError("VALIDATION_ERROR", "A task cannot depend on itself", 422);
    }

    // Verify both tasks exist
    const [predecessor, successor] = await Promise.all([
      db.query.pmTask.findFirst({ where: eq(pmTask.id, predecessorTaskId), columns: { id: true } }),
      db.query.pmTask.findFirst({ where: eq(pmTask.id, successorTaskId), columns: { id: true } }),
    ]);
    if (!predecessor) {
      throw new AppError("TASK_NOT_FOUND", `Predecessor task '${predecessorTaskId}' not found`, 404);
    }
    if (!successor) {
      throw new AppError("TASK_NOT_FOUND", `Successor task '${successorTaskId}' not found`, 404);
    }

    // Check for duplicate
    const existing = await db.query.pmDependency.findFirst({
      where: and(
        eq(pmDependency.predecessorTaskId, predecessorTaskId),
        eq(pmDependency.successorTaskId, successorTaskId),
      ),
    });
    if (existing) {
      throw new AppError("DEPENDENCY_DUPLICATE", "This dependency already exists", 409);
    }

    // Check for circular dependency: walk successors of successorTaskId to see if we reach predecessorTaskId
    await this.checkCircular(predecessorTaskId, successorTaskId);

    const id = ulid();
    const timestamp = now();

    await db.insert(pmDependency).values({
      id,
      predecessorTaskId,
      successorTaskId,
      depType: input.depType ?? "FS",
      lagMinutes: input.lagMinutes ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "dependency.created",
      entityType: "dependency",
      entityId: id,
      payload: { predecessorTaskId, successorTaskId, depType: input.depType ?? "FS" },
    });

    return db.query.pmDependency.findFirst({
      where: eq(pmDependency.id, id),
    });
  },

  async checkCircular(predecessorTaskId: string, successorTaskId: string) {
    // BFS from successorTaskId: follow all successors. If we reach predecessorTaskId, it's circular.
    const visited = new Set<string>();
    const queue = [successorTaskId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === predecessorTaskId) {
        throw new AppError(
          "DEPENDENCY_CIRCULAR",
          "Adding this dependency would create a circular dependency chain",
          422,
        );
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await db.query.pmDependency.findMany({
        where: eq(pmDependency.predecessorTaskId, current),
        columns: { successorTaskId: true },
      });
      for (const dep of deps) {
        if (!visited.has(dep.successorTaskId)) {
          queue.push(dep.successorTaskId);
        }
      }
    }
  },

  async list(taskId: string) {
    const [predecessors, successors] = await Promise.all([
      db.query.pmDependency.findMany({
        where: eq(pmDependency.successorTaskId, taskId),
      }),
      db.query.pmDependency.findMany({
        where: eq(pmDependency.predecessorTaskId, taskId),
      }),
    ]);

    return { predecessors, successors };
  },

  async delete(id: string) {
    const dep = await db.query.pmDependency.findFirst({
      where: eq(pmDependency.id, id),
    });
    if (!dep) {
      throw new AppError("NOT_FOUND", `Dependency '${id}' not found`, 404);
    }

    await db.delete(pmDependency).where(eq(pmDependency.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "dependency.deleted",
      entityType: "dependency",
      entityId: id,
      payload: { predecessorTaskId: dep.predecessorTaskId, successorTaskId: dep.successorTaskId },
    });
  },
};
