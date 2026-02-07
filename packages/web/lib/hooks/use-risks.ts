"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Risk = Record<string, unknown>;

export function useRisks(projectId: string) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Risk>>(
        `/api/risks${buildQuery({ projectId, limit: 100 })}`,
      );
      setRisks(data.items);
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

  return { risks, total, loading, refresh };
}

export function useCreateRisk() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRisk = useCallback(
    async (body: {
      projectId: string;
      title: string;
      probability?: string;
      impact?: string;
      mitigationPlan?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Risk>("/api/risks", body);
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

  return { createRisk, loading, error };
}

export function useUpdateRisk() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRisk = useCallback(
    async (
      id: string,
      body: {
        title?: string;
        probability?: string;
        impact?: string;
        mitigationPlan?: string;
        status?: string;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.patch<Risk>(`/api/risks/${id}`, body);
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

  return { updateRisk, loading, error };
}

export function useDeleteRisk() {
  const [loading, setLoading] = useState(false);

  const deleteRisk = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/risks/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteRisk, loading };
}
