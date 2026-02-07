import { eq, asc } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmWorkflow, pmWorkflowStage, pmProject } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

export interface CreateWorkflowInput {
  projectId: string;
  name: string;
  isDefault?: boolean;
  stages?: Array<{
    name: string;
    category: "ACTIVE" | "COMPLETED" | "DEFERRED" | "CANCELLED";
    color?: string;
  }>;
}

export interface CreateStageInput {
  name: string;
  category: "ACTIVE" | "COMPLETED" | "DEFERRED" | "CANCELLED";
  position?: number;
  color?: string;
}

export interface UpdateStageInput {
  name?: string;
  category?: "ACTIVE" | "COMPLETED" | "DEFERRED" | "CANCELLED";
  position?: number;
  color?: string;
}

const now = () => Date.now();

export const workflowService = {
  async create(input: CreateWorkflowInput, _userId: string) {
    // Verify project exists
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, input.projectId),
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project '${input.projectId}' not found`, 404);
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmWorkflow).values({
      id,
      projectId: input.projectId,
      name: input.name,
      isDefault: input.isDefault ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Create stages if provided
    if (input.stages && input.stages.length > 0) {
      await db.insert(pmWorkflowStage).values(
        input.stages.map((s, i) => ({
          id: ulid(),
          workflowId: id,
          name: s.name,
          category: s.category,
          position: i,
          color: s.color,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    }

    // If this is the default workflow, set it on the project
    if (input.isDefault) {
      await db.update(pmProject).set({ defaultWorkflowId: id, updatedAt: timestamp }).where(eq(pmProject.id, input.projectId));
    }

    return this.getById(id);
  },

  async getById(id: string) {
    const workflow = await db.query.pmWorkflow.findFirst({
      where: eq(pmWorkflow.id, id),
      with: { stages: { orderBy: [asc(pmWorkflowStage.position)] } },
    });
    if (!workflow) {
      throw new AppError("WORKFLOW_NOT_FOUND", `Workflow '${id}' not found`, 404);
    }
    return workflow;
  },

  async listByProject(projectId: string) {
    return db.query.pmWorkflow.findMany({
      where: eq(pmWorkflow.projectId, projectId),
      with: { stages: { orderBy: [asc(pmWorkflowStage.position)] } },
    });
  },

  async addStage(workflowId: string, input: CreateStageInput) {
    await this.getById(workflowId);

    // Determine position
    const existingStages = await db.query.pmWorkflowStage.findMany({
      where: eq(pmWorkflowStage.workflowId, workflowId),
      columns: { position: true },
    });
    const maxPos = existingStages.length > 0 ? Math.max(...existingStages.map(s => s.position)) : -1;

    const id = ulid();
    const timestamp = now();

    await db.insert(pmWorkflowStage).values({
      id,
      workflowId,
      name: input.name,
      category: input.category,
      position: input.position ?? maxPos + 1,
      color: input.color,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.getById(workflowId);
  },

  async updateStage(stageId: string, input: UpdateStageInput) {
    const stage = await db.query.pmWorkflowStage.findFirst({
      where: eq(pmWorkflowStage.id, stageId),
    });
    if (!stage) {
      throw new AppError("STAGE_NOT_FOUND", `Stage '${stageId}' not found`, 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.color !== undefined) updateData.color = input.color;

    await db.update(pmWorkflowStage).set(updateData).where(eq(pmWorkflowStage.id, stageId));

    return this.getById(stage.workflowId);
  },

  async deleteStage(stageId: string) {
    const stage = await db.query.pmWorkflowStage.findFirst({
      where: eq(pmWorkflowStage.id, stageId),
    });
    if (!stage) {
      throw new AppError("STAGE_NOT_FOUND", `Stage '${stageId}' not found`, 404);
    }

    await db.delete(pmWorkflowStage).where(eq(pmWorkflowStage.id, stageId));
    return this.getById(stage.workflowId);
  },

  async delete(id: string) {
    const workflow = await this.getById(id);
    // Delete stages first
    await db.delete(pmWorkflowStage).where(eq(pmWorkflowStage.workflowId, id));
    await db.delete(pmWorkflow).where(eq(pmWorkflow.id, id));
    return workflow;
  },
};
