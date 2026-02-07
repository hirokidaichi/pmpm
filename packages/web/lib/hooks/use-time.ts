"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type TimeEntry = Record<string, unknown>;
type TimerStatus = Record<string, unknown> | null;
type TimeCategory = Record<string, unknown>;

export function useTimerStatus() {
  const [timer, setTimer] = useState<TimerStatus>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<TimerStatus>("/api/time/status");
      setTimer(data);
    } catch {
      setTimer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { timer, loading, refresh };
}

export function useStartTimer() {
  const [loading, setLoading] = useState(false);

  const startTimer = useCallback(async (taskId: string) => {
    setLoading(true);
    try {
      const result = await api.post<Record<string, unknown>>("/api/time/start", { taskId });
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { startTimer, loading };
}

export function useStopTimer() {
  const [loading, setLoading] = useState(false);

  const stopTimer = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.post<Record<string, unknown>>("/api/time/stop");
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { stopTimer, loading };
}

export function useLogTime() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logTime = useCallback(
    async (body: { taskId: string; minutes: number; comment?: string; categoryId?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<TimeEntry>("/api/time/entries", body);
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

  return { logTime, loading, error };
}

export function useTimeEntries(taskId?: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<TimeEntry>>(
        `/api/time/entries${buildQuery({ taskId, limit: 100 })}`,
      );
      setEntries(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, total, loading, refresh };
}

export function useDeleteTimeEntry() {
  const [loading, setLoading] = useState(false);

  const deleteTimeEntry = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/time/entries/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteTimeEntry, loading };
}

export function useTimeCategories() {
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<TimeCategory[]>("/api/time/categories");
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, loading, refresh };
}

export function useCreateTimeCategory() {
  const [loading, setLoading] = useState(false);

  const createCategory = useCallback(async (body: { name: string }) => {
    setLoading(true);
    try {
      const result = await api.post<TimeCategory>("/api/time/categories", body);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createCategory, loading };
}
