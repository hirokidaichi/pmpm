"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Reminder = Record<string, unknown>;

export function useReminders(params?: { status?: string; limit?: number }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Reminder>>(
        `/api/reminders${buildQuery({ status: params?.status, limit: params?.limit ?? 50 })}`,
      );
      setReminders(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reminders, total, loading, refresh };
}

export function useCreateReminder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReminder = useCallback(
    async (body: {
      title: string;
      remindAt: number;
      repeatType?: string;
      taskId?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Reminder>("/api/reminders", body);
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

  return { createReminder, loading, error };
}

export function useCancelReminder() {
  const [loading, setLoading] = useState(false);

  const cancelReminder = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.patch(`/api/reminders/${id}/cancel`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { cancelReminder, loading };
}

export function useDeleteReminder() {
  const [loading, setLoading] = useState(false);

  const deleteReminder = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/reminders/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteReminder, loading };
}
