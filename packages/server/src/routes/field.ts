import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { resolveProject, requirePermission } from "../middleware/accessControl.js";
import { db } from "../db/client.js";
import {
  pmCustomField,
  pmCustomFieldOption,
  pmCustomFieldValue,
  pmCustomFieldValueMulti,
} from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const createFieldSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "DROPDOWN", "MULTI_SELECT", "USER", "CHECKBOX"]),
  isRequired: z.boolean().optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).optional(),
        value: z.string().min(1),
        color: z.string().max(7).optional(),
      }),
    )
    .optional(),
});

const updateFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().optional(),
});

const listFieldsSchema = z.object({
  projectId: z.string().optional(),
});

const setValueSchema = z.object({
  fieldId: z.string().min(1),
  taskId: z.string().min(1),
  valueText: z.string().optional(),
  valueNumber: z.number().optional(),
  valueDate: z.number().optional(),
  valueOptionId: z.string().optional(),
  valueUserId: z.string().optional(),
  valueCheckbox: z.boolean().optional(),
  optionIds: z.array(z.string()).optional(),
});

const unsetValueSchema = z.object({
  fieldId: z.string().min(1),
  taskId: z.string().min(1),
});

// Helper to add label to options in responses
function addOptionLabels(field: Record<string, unknown> & { options?: Array<Record<string, unknown>> }) {
  return {
    ...field,
    options: field.options?.map((opt) => ({ ...opt, label: opt.value })) ?? [],
  };
}

export const fieldRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("STAKEHOLDER"),
    zValidator("query", listFieldsSchema),
    resolveProject({ from: "query", key: "projectId" }),
    requirePermission("read", { skipIfNoContext: true }),
    async (c) => {
      const query = c.req.valid("query");
      const conditions = [];
      if (query.projectId) {
        conditions.push(eq(pmCustomField.projectId, query.projectId));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const fields = await db.query.pmCustomField.findMany({
        where,
        with: { options: { orderBy: [asc(pmCustomFieldOption.position)] } },
      });
      return c.json(fields.map(addOptionLabels));
    },
  )
  .post(
    "/",
    requireRole("MEMBER"),
    zValidator("json", createFieldSchema),
    resolveProject({ from: "body", key: "projectId" }),
    requirePermission("write", { skipIfNoContext: true }),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const id = ulid();
      const timestamp = now();

      await db.insert(pmCustomField).values({
        id,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        fieldType: input.fieldType,
        isRequired: input.isRequired ? 1 : 0,
        createdBy: user.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (input.options && input.options.length > 0) {
        await db.insert(pmCustomFieldOption).values(
          input.options.map((opt, i) => ({
            id: ulid(),
            fieldId: id,
            value: opt.value,
            position: i,
            color: opt.color,
          })),
        );
      }

      const created = await db.query.pmCustomField.findFirst({
        where: eq(pmCustomField.id, id),
        with: { options: true },
      });
      return c.json(created ? addOptionLabels(created) : created, 201);
    },
  )
  .put(
    "/:id",
    requireRole("MEMBER"),
    zValidator("json", updateFieldSchema),
    async (c) => {
      const fieldId = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.pmCustomField.findFirst({
        where: eq(pmCustomField.id, fieldId),
      });
      if (!existing) {
        throw new AppError("FIELD_NOT_FOUND", "Custom field not found", 404);
      }

      const updateData: Record<string, unknown> = { updatedAt: now() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isRequired !== undefined) updateData.isRequired = input.isRequired ? 1 : 0;

      await db.update(pmCustomField).set(updateData).where(eq(pmCustomField.id, fieldId));
      const updated = await db.query.pmCustomField.findFirst({
        where: eq(pmCustomField.id, fieldId),
        with: { options: true },
      });
      return c.json(updated ? addOptionLabels(updated) : updated);
    },
  )
  .post(
    "/values",
    requireRole("MEMBER"),
    zValidator("json", setValueSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user")!;
      const timestamp = now();

      // Check field exists
      const field = await db.query.pmCustomField.findFirst({
        where: eq(pmCustomField.id, input.fieldId),
      });
      if (!field) {
        throw new AppError("FIELD_NOT_FOUND", "Custom field not found", 404);
      }

      // Handle MULTI_SELECT separately
      if (field.fieldType === "MULTI_SELECT" && input.optionIds) {
        // Remove existing multi values
        await db
          .delete(pmCustomFieldValueMulti)
          .where(
            and(
              eq(pmCustomFieldValueMulti.fieldId, input.fieldId),
              eq(pmCustomFieldValueMulti.taskId, input.taskId),
            ),
          );

        if (input.optionIds.length > 0) {
          await db.insert(pmCustomFieldValueMulti).values(
            input.optionIds.map((optId) => ({
              fieldId: input.fieldId,
              taskId: input.taskId,
              optionId: optId,
              updatedBy: user.id,
              updatedAt: timestamp,
            })),
          );
        }

        return c.json({ success: true, fieldId: input.fieldId, taskId: input.taskId });
      }

      // Single value: upsert
      const existing = await db.query.pmCustomFieldValue.findFirst({
        where: and(
          eq(pmCustomFieldValue.fieldId, input.fieldId),
          eq(pmCustomFieldValue.taskId, input.taskId),
        ),
      });

      const valueData = {
        fieldId: input.fieldId,
        taskId: input.taskId,
        valueText: input.valueText ?? null,
        valueNumber: input.valueNumber ?? null,
        valueDate: input.valueDate ?? null,
        valueOptionId: input.valueOptionId ?? null,
        valueUserId: input.valueUserId ?? null,
        valueCheckbox: input.valueCheckbox !== undefined ? (input.valueCheckbox ? 1 : 0) : null,
        updatedBy: user.id,
        updatedAt: timestamp,
      };

      if (existing) {
        await db
          .update(pmCustomFieldValue)
          .set(valueData)
          .where(
            and(
              eq(pmCustomFieldValue.fieldId, input.fieldId),
              eq(pmCustomFieldValue.taskId, input.taskId),
            ),
          );
      } else {
        await db.insert(pmCustomFieldValue).values(valueData);
      }

      return c.json({ success: true, fieldId: input.fieldId, taskId: input.taskId });
    },
  )
  .delete(
    "/values",
    requireRole("MEMBER"),
    zValidator("json", unsetValueSchema),
    async (c) => {
      const input = c.req.valid("json");

      await db
        .delete(pmCustomFieldValue)
        .where(
          and(
            eq(pmCustomFieldValue.fieldId, input.fieldId),
            eq(pmCustomFieldValue.taskId, input.taskId),
          ),
        );

      await db
        .delete(pmCustomFieldValueMulti)
        .where(
          and(
            eq(pmCustomFieldValueMulti.fieldId, input.fieldId),
            eq(pmCustomFieldValueMulti.taskId, input.taskId),
          ),
        );

      return c.json({ success: true });
    },
  );
