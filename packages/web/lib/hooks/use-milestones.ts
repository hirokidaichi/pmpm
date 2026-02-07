"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Milestone = Record<string, unknown>;

export function useMilestones(projectId: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Milestone>>(
        `/api/milestones${buildQuery({ projectId, limit: 100 })}`,
      );
      setMilestones(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { milestones, total, loading, refresh };
}

export function useCreateMilestone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMilestone = useCallback(
    async (body: { projectId: string; name: string; description?: string; dueAt?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Milestone>("/api/milestones", body);
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

  return { createMilestone, loading, error };
}

export function useUpdateMilestone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMilestone = useCallback(
    async (
      id: string,
      body: { name?: string; description?: string; dueAt?: number; status?: string },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.patch<Milestone>(`/api/milestones/${id}`, body);
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

  return { updateMilestone, loading, error };
}

export function useDeleteMilestone() {
  const [loading, setLoading] = useState(false);

  const deleteMilestone = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/milestones/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteMilestone, loading };
}
