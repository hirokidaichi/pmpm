"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";

type ServerStatus = Record<string, unknown>;
type Member = Record<string, unknown>;

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<ServerStatus>("/api/server/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}

export function useServerMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: Member[] }>("/api/server/members");
      setMembers(data.items ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { members, loading, refresh };
}

export function useInviteMember() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteMember = useCallback(async (body: { email: string; role?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<Member>("/api/server/members/invite", body);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { inviteMember, loading, error };
}

export function useUpdateMember() {
  const [loading, setLoading] = useState(false);

  const updateMember = useCallback(async (userId: string, body: { role: string }) => {
    setLoading(true);
    try {
      const result = await api.patch<Member>(`/api/server/members/${userId}`, body);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateMember, loading };
}

export function useRemoveMember() {
  const [loading, setLoading] = useState(false);

  const removeMember = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/server/members/${userId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { removeMember, loading };
}
