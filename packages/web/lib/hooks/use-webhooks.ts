"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Webhook = Record<string, unknown>;

export function useWebhooks(params?: { limit?: number }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Webhook[] | Paginated<Webhook>>(
        `/api/webhooks${buildQuery({ limit: params?.limit ?? 50 })}`,
      );
      const items = Array.isArray(data) ? data : data.items;
      setWebhooks(items);
      setTotal(Array.isArray(data) ? items.length : data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [params?.limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { webhooks, total, loading, refresh };
}

export function useCreateWebhook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createWebhook = useCallback(
    async (body: { url: string; events: string[]; secret?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Webhook>("/api/webhooks", body);
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

  return { createWebhook, loading, error };
}

export function useUpdateWebhook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateWebhook = useCallback(
    async (
      id: string,
      body: { url?: string; events?: string[]; secret?: string; active?: boolean },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.patch<Webhook>(`/api/webhooks/${id}`, body);
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

  return { updateWebhook, loading, error };
}

export function useDeleteWebhook() {
  const [loading, setLoading] = useState(false);

  const deleteWebhook = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/webhooks/${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteWebhook, loading };
}

export function useTestWebhook() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const testWebhook = useCallback(async (id: string) => {
    setLoading(true);
    setSuccess(false);
    try {
      await api.post(`/api/webhooks/${id}/test`);
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return { testWebhook, loading, success };
}
