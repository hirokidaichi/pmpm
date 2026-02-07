"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type InboxMessage = Record<string, unknown>;

export function useInbox(params?: { unreadOnly?: boolean; limit?: number }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<InboxMessage>>(
        `/api/inbox${buildQuery({ ...params, limit: params?.limit ?? 50 })}`,
      );
      setMessages(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [params?.unreadOnly, params?.limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { messages, total, loading, refresh };
}

export function useInboxCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchCount() {
      try {
        const data = await api.get<{ unread: number }>("/api/inbox/count");
        if (active) setCount(data.unread ?? 0);
      } catch {
        // silently ignore
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}

export function useMarkRead() {
  const [loading, setLoading] = useState(false);

  const markRead = useCallback(async (messageId: string) => {
    setLoading(true);
    try {
      await api.patch(`/api/inbox/${messageId}/read`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { markRead, loading };
}

export function useMarkAllRead() {
  const [loading, setLoading] = useState(false);

  const markAllRead = useCallback(async () => {
    setLoading(true);
    try {
      await api.post("/api/inbox/read-all");
    } finally {
      setLoading(false);
    }
  }, []);

  return { markAllRead, loading };
}

export function useSendMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (body: { recipientUserId: string; title: string; bodyMd?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<InboxMessage>("/api/inbox/send", body);
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

  return { sendMessage, loading, error };
}
