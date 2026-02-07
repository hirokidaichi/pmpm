"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type DailyReport = Record<string, unknown>;

export function useDailyReports(params?: { limit?: number; projectId?: string }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<DailyReport>>(
        `/api/daily-reports${buildQuery({ limit: params?.limit ?? 30, projectId: params?.projectId })}`,
      );
      setReports(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [params?.limit, params?.projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reports, total, loading, refresh };
}

export function useCreateDaily() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDaily = useCallback(
    async (body: {
      reportDate: string;
      projectId?: string;
      achievements: string[];
      plans: string[];
      issues: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<DailyReport>("/api/daily-reports", body);
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

  return { createDaily, loading, error };
}

export function useUpdateDaily() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDaily = useCallback(
    async (
      id: string,
      body: {
        achievements?: string[];
        plans?: string[];
        issues?: string[];
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.patch<DailyReport>(`/api/daily-reports/${id}`, body);
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

  return { updateDaily, loading, error };
}

export function useDeleteDaily() {
  const [loading, setLoading] = useState(false);

  const deleteDaily = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/daily-reports/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteDaily, loading };
}

export function useDailyPreview(reportDate: string, projectId?: string) {
  const [preview, setPreview] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!reportDate) return;
    setLoading(true);
    try {
      const data = await api.get<DailyReport>(
        `/api/daily-reports/preview${buildQuery({ reportDate, projectId })}`,
      );
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [reportDate, projectId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  return { preview, loading, fetchPreview };
}
