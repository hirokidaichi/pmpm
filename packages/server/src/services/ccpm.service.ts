import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { pmTask, pmProject } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import type {
  CriticalChainResult,
  CriticalChainTask,
  ProjectForecast,
  ForecastPercentile,
  ForecastHistogramBin,
} from "@pmpm/shared/types";

// Internal node representation for scheduling
interface ScheduleNode {
  taskId: string;
  title: string;
  optimistic: number;
  pessimistic: number;
  assigneeUserIds: string[];
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
}

interface DepEdge {
  predecessorTaskId: string;
  successorTaskId: string;
  depType: "FS" | "SS" | "FF" | "SF";
  lagMinutes: number;
}

export const ccpmService = {
  /**
   * Compute the critical chain for a project.
   *
   * 1. Load tasks + dependencies
   * 2. Forward pass (early start/finish) using optimistic estimates
   * 3. Backward pass (late start/finish)
   * 4. Critical path = tasks with totalFloat === 0
   * 5. Resource contention: add implicit FS deps for same-assignee overlap
   * 6. Re-run passes to get the critical chain
   * 7. Identify feeding chains
   * 8. Calculate buffers (RSS)
   */
  async analyzeCriticalChain(projectId: string): Promise<CriticalChainResult> {
    // Step 1: Load tasks
    const tasks = await db.query.pmTask.findMany({
      where: and(eq(pmTask.projectId, projectId), isNull(pmTask.deletedAt)),
      with: { assignees: true },
    });

    if (tasks.length === 0) {
      throw new AppError(
        "CCPM_INSUFFICIENT_DATA",
        "No tasks found in this project",
        422,
      );
    }

    // Load dependencies for these tasks
    const taskIds = new Set(tasks.map((t) => t.id));
    const allDeps = await db.query.pmDependency.findMany();
    const projectDeps: DepEdge[] = allDeps
      .filter(
        (d) =>
          taskIds.has(d.predecessorTaskId) && taskIds.has(d.successorTaskId),
      )
      .map((d) => ({
        predecessorTaskId: d.predecessorTaskId,
        successorTaskId: d.successorTaskId,
        depType: d.depType as DepEdge["depType"],
        lagMinutes: d.lagMinutes,
      }));

    if (projectDeps.length === 0) {
      throw new AppError(
        "CCPM_NO_DEPENDENCIES",
        "No dependencies found; cannot compute critical chain",
        422,
      );
    }

    // Build node map
    const nodeMap = new Map<string, ScheduleNode>();
    for (const t of tasks) {
      const optimistic =
        t.optimisticMinutes ?? t.effortMinutes ?? 0;
      const pessimistic =
        t.pessimisticMinutes ?? (Math.round(optimistic * 1.5) || 0);
      nodeMap.set(t.id, {
        taskId: t.id,
        title: t.title,
        optimistic,
        pessimistic,
        assigneeUserIds: t.assignees
          .filter((a) => a.role === "ASSIGNEE")
          .map((a) => a.userId),
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: 0,
        lateFinish: 0,
        totalFloat: 0,
      });
    }

    // Step 2-5: Compute with resource contention resolution
    const augmentedDeps = this.resolveResourceContention(
      nodeMap,
      projectDeps,
    );
    this.computeSchedule(nodeMap, augmentedDeps);

    // Step 6: Identify critical chain (totalFloat === 0)
    const criticalChainIds = new Set<string>();
    for (const [id, node] of nodeMap) {
      if (node.totalFloat === 0) {
        criticalChainIds.add(id);
      }
    }

    // Sort critical chain by earlyStart
    const criticalChain: CriticalChainTask[] = [...criticalChainIds]
      .map((id) => nodeMap.get(id)!)
      .sort((a, b) => a.earlyStart - b.earlyStart)
      .map((n) => ({
        taskId: n.taskId,
        title: n.title,
        optimisticMinutes: n.optimistic,
        pessimisticMinutes: n.pessimistic,
        assigneeUserIds: n.assigneeUserIds,
        earlyStart: n.earlyStart,
        earlyFinish: n.earlyFinish,
      }));

    // Step 7: Identify feeding chains
    const feedingChains = this.identifyFeedingChains(
      nodeMap,
      augmentedDeps,
      criticalChainIds,
    );

    // Step 8: Calculate buffers using RSS
    const projectBufferMinutes = this.calculateBufferRSS(
      criticalChain.map((t) => ({
        optimisticMinutes: t.optimisticMinutes,
        pessimisticMinutes: t.pessimisticMinutes,
      })),
    );

    const feedingBuffers = feedingChains.map((fc) => ({
      mergeTaskId: fc.mergeTaskId,
      bufferMinutes: this.calculateBufferRSS(
        fc.tasks.map((t) => ({
          optimisticMinutes: t.optimisticMinutes,
          pessimisticMinutes: t.pessimisticMinutes,
        })),
      ),
    }));

    // Total duration = max earlyFinish on critical chain + project buffer
    const maxEarlyFinish = criticalChain.length > 0
      ? Math.max(...criticalChain.map((t) => t.earlyFinish))
      : 0;

    return {
      criticalChain,
      feedingChains,
      projectBufferMinutes,
      feedingBuffers,
      totalProjectDurationMinutes: maxEarlyFinish + projectBufferMinutes,
    };
  },

  /**
   * Forward and backward pass to compute schedule.
   */
  computeSchedule(
    nodeMap: Map<string, ScheduleNode>,
    deps: DepEdge[],
  ): void {
    // Build adjacency
    const predecessorMap = new Map<string, DepEdge[]>(); // taskId -> deps where task is successor
    const successorMap = new Map<string, DepEdge[]>(); // taskId -> deps where task is predecessor
    for (const id of nodeMap.keys()) {
      predecessorMap.set(id, []);
      successorMap.set(id, []);
    }
    for (const d of deps) {
      predecessorMap.get(d.successorTaskId)?.push(d);
      successorMap.get(d.predecessorTaskId)?.push(d);
    }

    // Topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    for (const id of nodeMap.keys()) {
      inDegree.set(id, 0);
    }
    for (const d of deps) {
      inDegree.set(
        d.successorTaskId,
        (inDegree.get(d.successorTaskId) ?? 0) + 1,
      );
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      topoOrder.push(current);
      for (const d of successorMap.get(current) ?? []) {
        const newDeg = (inDegree.get(d.successorTaskId) ?? 1) - 1;
        inDegree.set(d.successorTaskId, newDeg);
        if (newDeg === 0) queue.push(d.successorTaskId);
      }
    }

    // Forward pass
    for (const id of nodeMap.keys()) {
      const node = nodeMap.get(id)!;
      node.earlyStart = 0;
      node.earlyFinish = node.optimistic;
    }

    for (const id of topoOrder) {
      const node = nodeMap.get(id)!;
      const preds = predecessorMap.get(id) ?? [];

      for (const dep of preds) {
        const pred = nodeMap.get(dep.predecessorTaskId)!;
        switch (dep.depType) {
          case "FS":
            node.earlyStart = Math.max(
              node.earlyStart,
              pred.earlyFinish + dep.lagMinutes,
            );
            break;
          case "SS":
            node.earlyStart = Math.max(
              node.earlyStart,
              pred.earlyStart + dep.lagMinutes,
            );
            break;
          case "FF":
            // EF >= pred.EF + lag, so ES >= pred.EF + lag - duration
            node.earlyStart = Math.max(
              node.earlyStart,
              pred.earlyFinish + dep.lagMinutes - node.optimistic,
            );
            break;
          case "SF":
            // EF >= pred.ES + lag, so ES >= pred.ES + lag - duration
            node.earlyStart = Math.max(
              node.earlyStart,
              pred.earlyStart + dep.lagMinutes - node.optimistic,
            );
            break;
        }
      }

      node.earlyFinish = node.earlyStart + node.optimistic;
    }

    // Backward pass
    const projectEnd = Math.max(
      ...Array.from(nodeMap.values()).map((n) => n.earlyFinish),
    );

    for (const id of nodeMap.keys()) {
      const node = nodeMap.get(id)!;
      node.lateFinish = projectEnd;
      node.lateStart = projectEnd - node.optimistic;
    }

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const node = nodeMap.get(id)!;
      const succs = successorMap.get(id) ?? [];

      for (const dep of succs) {
        const succ = nodeMap.get(dep.successorTaskId)!;
        switch (dep.depType) {
          case "FS":
            node.lateFinish = Math.min(
              node.lateFinish,
              succ.lateStart - dep.lagMinutes,
            );
            break;
          case "SS":
            node.lateStart = Math.min(
              node.lateStart,
              succ.lateStart - dep.lagMinutes,
            );
            break;
          case "FF":
            node.lateFinish = Math.min(
              node.lateFinish,
              succ.lateFinish - dep.lagMinutes,
            );
            break;
          case "SF":
            node.lateStart = Math.min(
              node.lateStart,
              succ.lateFinish - dep.lagMinutes,
            );
            break;
        }
      }

      node.lateStart = Math.min(
        node.lateStart,
        node.lateFinish - node.optimistic,
      );
      node.totalFloat = node.lateStart - node.earlyStart;
    }
  },

  /**
   * Resolve resource contention by adding implicit FS dependencies
   * when two tasks share an assignee and overlap in time.
   */
  resolveResourceContention(
    nodeMap: Map<string, ScheduleNode>,
    deps: DepEdge[],
  ): DepEdge[] {
    // First, compute schedule without resource contention
    this.computeSchedule(nodeMap, deps);

    const augmented = [...deps];
    const nodes = Array.from(nodeMap.values());

    // Group tasks by assignee
    const byAssignee = new Map<string, ScheduleNode[]>();
    for (const node of nodes) {
      for (const userId of node.assigneeUserIds) {
        if (!byAssignee.has(userId)) byAssignee.set(userId, []);
        byAssignee.get(userId)!.push(node);
      }
    }

    // For each assignee with overlapping tasks, add implicit dependency
    for (const [, assigneeTasks] of byAssignee) {
      if (assigneeTasks.length < 2) continue;

      // Sort by earlyStart
      const sorted = [...assigneeTasks].sort(
        (a, b) => a.earlyStart - b.earlyStart,
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];

        // Check overlap: a.earlyFinish > b.earlyStart
        if (a.earlyFinish > b.earlyStart) {
          // Check if dependency already exists
          const exists = augmented.some(
            (d) =>
              (d.predecessorTaskId === a.taskId &&
                d.successorTaskId === b.taskId) ||
              (d.predecessorTaskId === b.taskId &&
                d.successorTaskId === a.taskId),
          );
          if (!exists) {
            augmented.push({
              predecessorTaskId: a.taskId,
              successorTaskId: b.taskId,
              depType: "FS",
              lagMinutes: 0,
            });
          }
        }
      }
    }

    // Re-compute with augmented deps if new deps were added
    if (augmented.length > deps.length) {
      this.computeSchedule(nodeMap, augmented);
    }

    return augmented;
  },

  /**
   * Identify feeding chains: non-critical paths merging into the critical chain.
   */
  identifyFeedingChains(
    nodeMap: Map<string, ScheduleNode>,
    deps: DepEdge[],
    criticalChainIds: Set<string>,
  ): Array<{ mergeTaskId: string; tasks: CriticalChainTask[] }> {
    // Build predecessor map
    const predecessorMap = new Map<string, DepEdge[]>();
    for (const id of nodeMap.keys()) {
      predecessorMap.set(id, []);
    }
    for (const d of deps) {
      predecessorMap.get(d.successorTaskId)?.push(d);
    }

    const feedingChains: Array<{
      mergeTaskId: string;
      tasks: CriticalChainTask[];
    }> = [];
    const visited = new Set<string>();

    // For each critical chain task, find non-critical predecessors
    for (const ccTaskId of criticalChainIds) {
      const preds = predecessorMap.get(ccTaskId) ?? [];
      for (const dep of preds) {
        if (
          criticalChainIds.has(dep.predecessorTaskId) ||
          visited.has(dep.predecessorTaskId)
        ) {
          continue;
        }

        // Trace back through non-critical predecessors
        const chainTasks: CriticalChainTask[] = [];
        const traceQueue = [dep.predecessorTaskId];

        while (traceQueue.length > 0) {
          const taskId = traceQueue.shift()!;
          if (visited.has(taskId) || criticalChainIds.has(taskId)) continue;
          visited.add(taskId);

          const node = nodeMap.get(taskId);
          if (!node) continue;

          chainTasks.push({
            taskId: node.taskId,
            title: node.title,
            optimisticMinutes: node.optimistic,
            pessimisticMinutes: node.pessimistic,
            assigneeUserIds: node.assigneeUserIds,
            earlyStart: node.earlyStart,
            earlyFinish: node.earlyFinish,
          });

          // Continue tracing predecessors
          for (const p of predecessorMap.get(taskId) ?? []) {
            if (
              !visited.has(p.predecessorTaskId) &&
              !criticalChainIds.has(p.predecessorTaskId)
            ) {
              traceQueue.push(p.predecessorTaskId);
            }
          }
        }

        if (chainTasks.length > 0) {
          chainTasks.sort((a, b) => a.earlyStart - b.earlyStart);
          feedingChains.push({
            mergeTaskId: ccTaskId,
            tasks: chainTasks,
          });
        }
      }
    }

    return feedingChains;
  },

  /**
   * Calculate buffer using Root Sum Square (RSS) method.
   * buffer = sqrt(sum((pessimistic - optimistic)^2)) / 2
   */
  calculateBufferRSS(
    tasks: Array<{ optimisticMinutes: number; pessimisticMinutes: number }>,
  ): number {
    const sumSquares = tasks.reduce((sum, t) => {
      const diff = t.pessimisticMinutes - t.optimisticMinutes;
      return sum + diff * diff;
    }, 0);
    return Math.round(Math.sqrt(sumSquares) / 2);
  },

  /**
   * Project completion forecast using Monte Carlo simulation.
   *
   * Runs N iterations where each task's duration is sampled from a
   * right-skewed triangular distribution [optimistic, pessimistic]
   * with mode = optimistic. Returns percentile-based predictions
   * anchored to the project's startAt date.
   */
  async forecast(
    projectId: string,
    simulations: number = 1000,
  ): Promise<ProjectForecast> {
    // Load project for startAt
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, projectId),
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project '${projectId}' not found`, 404);
    }

    // Load tasks
    const tasks = await db.query.pmTask.findMany({
      where: and(eq(pmTask.projectId, projectId), isNull(pmTask.deletedAt)),
      with: { assignees: true },
    });

    if (tasks.length === 0) {
      throw new AppError("CCPM_INSUFFICIENT_DATA", "No tasks found in this project", 422);
    }

    const taskIds = new Set(tasks.map((t) => t.id));
    const allDeps = await db.query.pmDependency.findMany();
    const projectDeps: DepEdge[] = allDeps
      .filter((d) => taskIds.has(d.predecessorTaskId) && taskIds.has(d.successorTaskId))
      .map((d) => ({
        predecessorTaskId: d.predecessorTaskId,
        successorTaskId: d.successorTaskId,
        depType: d.depType as DepEdge["depType"],
        lagMinutes: d.lagMinutes,
      }));

    if (projectDeps.length === 0) {
      throw new AppError("CCPM_NO_DEPENDENCIES", "No dependencies found; cannot compute forecast", 422);
    }

    // Build task info for simulation
    const taskInfo: Array<{
      id: string;
      optimistic: number;
      pessimistic: number;
      assigneeUserIds: string[];
    }> = tasks.map((t) => {
      const optimistic = t.optimisticMinutes ?? t.effortMinutes ?? 0;
      const pessimistic = t.pessimisticMinutes ?? (Math.round(optimistic * 1.5) || 0);
      return {
        id: t.id,
        optimistic,
        pessimistic,
        assigneeUserIds: t.assignees
          .filter((a) => a.role === "ASSIGNEE")
          .map((a) => a.userId),
      };
    });

    // Resolve resource contention once to get the augmented dependency graph
    const nodeMapForContention = new Map<string, ScheduleNode>();
    for (const t of taskInfo) {
      nodeMapForContention.set(t.id, {
        taskId: t.id,
        title: "",
        optimistic: t.optimistic,
        pessimistic: t.pessimistic,
        assigneeUserIds: t.assigneeUserIds,
        earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0,
      });
    }
    const augmentedDeps = this.resolveResourceContention(nodeMapForContention, projectDeps);

    // Build topological order once (reuse across iterations)
    const topoOrder = this.topologicalSort(taskIds, augmentedDeps);
    const predecessorMap = new Map<string, DepEdge[]>();
    for (const id of taskIds) predecessorMap.set(id, []);
    for (const d of augmentedDeps) predecessorMap.get(d.successorTaskId)?.push(d);

    // Run Monte Carlo simulations
    const durations: number[] = new Array(simulations);

    for (let i = 0; i < simulations; i++) {
      // Sample durations for each task
      const sampled = new Map<string, number>();
      for (const t of taskInfo) {
        sampled.set(t.id, this.sampleTriangular(t.optimistic, t.pessimistic));
      }

      // Forward pass with sampled durations
      const earlyFinish = new Map<string, number>();
      const earlyStart = new Map<string, number>();

      for (const id of topoOrder) {
        const duration = sampled.get(id) ?? 0;
        let es = 0;

        for (const dep of predecessorMap.get(id) ?? []) {
          const predES = earlyStart.get(dep.predecessorTaskId) ?? 0;
          const predEF = earlyFinish.get(dep.predecessorTaskId) ?? 0;

          switch (dep.depType) {
            case "FS":
              es = Math.max(es, predEF + dep.lagMinutes);
              break;
            case "SS":
              es = Math.max(es, predES + dep.lagMinutes);
              break;
            case "FF":
              es = Math.max(es, predEF + dep.lagMinutes - duration);
              break;
            case "SF":
              es = Math.max(es, predES + dep.lagMinutes - duration);
              break;
          }
        }

        earlyStart.set(id, es);
        earlyFinish.set(id, es + duration);
      }

      // Project duration = max earlyFinish
      durations[i] = Math.max(...Array.from(earlyFinish.values()));
    }

    // Sort durations for percentile extraction
    durations.sort((a, b) => a - b);

    // Deterministic duration (from critical chain analysis)
    const ccResult = await this.analyzeCriticalChain(projectId);
    const deterministicDuration = ccResult.totalProjectDurationMinutes;

    // Calendar conversion helper
    const startMs = project.startAt;
    const startDate = startMs ? new Date(startMs).toISOString().slice(0, 10) : null;
    const toFinishDate = (durationMinutes: number): string | null => {
      if (!startMs) return null;
      return new Date(startMs + durationMinutes * 60_000).toISOString().slice(0, 10);
    };

    const percentile = (p: number): ForecastPercentile => {
      const idx = Math.min(Math.floor(durations.length * p), durations.length - 1);
      const dur = Math.round(durations[idx]);
      return { durationMinutes: dur, finishDate: toFinishDate(dur) };
    };

    // Build histogram (10 bins)
    const minDur = durations[0];
    const maxDur = durations[durations.length - 1];
    const binCount = 10;
    const binWidth = Math.max(Math.ceil((maxDur - minDur) / binCount), 1);
    const histogram: ForecastHistogramBin[] = [];
    for (let b = 0; b < binCount; b++) {
      const binMin = minDur + b * binWidth;
      const binMax = b === binCount - 1 ? maxDur + 1 : minDur + (b + 1) * binWidth;
      const count = durations.filter((d) => d >= binMin && d < binMax).length;
      histogram.push({ minMinutes: Math.round(binMin), maxMinutes: Math.round(binMax), count });
    }
    // Ensure last bin includes the max value
    if (histogram.length > 0) {
      histogram[histogram.length - 1].count += durations.filter((d) => d === maxDur).length > 0
        && histogram[histogram.length - 1].count === 0 ? 1 : 0;
    }

    return {
      startDate,
      deterministicDurationMinutes: deterministicDuration,
      deterministicFinishDate: toFinishDate(deterministicDuration),
      simulations,
      percentiles: {
        p50: percentile(0.5),
        p75: percentile(0.75),
        p80: percentile(0.8),
        p90: percentile(0.9),
        p95: percentile(0.95),
      },
      histogram,
    };
  },

  /**
   * Topological sort using Kahn's algorithm.
   */
  topologicalSort(taskIds: Set<string>, deps: DepEdge[]): string[] {
    const inDegree = new Map<string, number>();
    for (const id of taskIds) inDegree.set(id, 0);
    for (const d of deps) {
      if (taskIds.has(d.successorTaskId)) {
        inDegree.set(d.successorTaskId, (inDegree.get(d.successorTaskId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const d of deps) {
        if (d.predecessorTaskId === current && taskIds.has(d.successorTaskId)) {
          const newDeg = (inDegree.get(d.successorTaskId) ?? 1) - 1;
          inDegree.set(d.successorTaskId, newDeg);
          if (newDeg === 0) queue.push(d.successorTaskId);
        }
      }
    }

    return order;
  },

  /**
   * Sample from a right-skewed triangular distribution.
   * mode = min (optimistic), which models CCPM's assumption that
   * tasks are most likely to finish near the optimistic estimate
   * but have a long tail toward the pessimistic estimate.
   */
  sampleTriangular(min: number, max: number): number {
    if (min >= max) return min;
    const mode = min; // right-skewed: most likely = optimistic
    const u = Math.random();
    const fc = (mode - min) / (max - min); // = 0 when mode = min

    if (u < fc) {
      return min + Math.sqrt(u * (max - min) * (mode - min));
    }
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  },
};
