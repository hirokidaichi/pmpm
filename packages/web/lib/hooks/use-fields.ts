"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Field = Record<string, unknown>;

export function useFields(projectId: string) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Field>>(
        `/api/custom-fields${buildQuery({ projectId, limit: 100 })}`,
      );
      setFields(data.items);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { fields, loading, refresh };
}

export function useCreateField() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createField = useCallback(
    async (body: {
      projectId: string;
      name: string;
      fieldType: string;
      options?: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Field>("/api/custom-fields", body);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { createField, loading, error };
}

export function useUpdateField() {
  const [loading, setLoading] = useState(false);

  const updateField = useCallback(
    async (id: string, body: { name?: string; options?: string[] }) => {
      setLoading(true);
      try {
        const result = await api.patch<Field>(`/api/custom-fields/${id}`, body);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { updateField, loading };
}

export function useSetFieldValue() {
  const [loading, setLoading] = useState(false);

  const setFieldValue = useCallback(
    async (body: { taskId: string; fieldId: string; value: string }) => {
      setLoading(true);
      try {
        const result = await api.put<Record<string, unknown>>(
          `/api/custom-fields/${body.fieldId}/values`,
          { taskId: body.taskId, value: body.value },
        );
        return result;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { setFieldValue, loading };
}

export function useDeleteFieldValue() {
  const [loading, setLoading] = useState(false);

  const deleteFieldValue = useCallback(async (fieldId: string, taskId: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/custom-fields/${fieldId}/values?taskId=${taskId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteFieldValue, loading };
}
