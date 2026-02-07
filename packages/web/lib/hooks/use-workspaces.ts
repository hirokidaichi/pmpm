"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/endpoints";

// ── Query keys ──
const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...workspaceKeys.lists(), params] as const,
  details: () => [...workspaceKeys.all, "detail"] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
};

// ── Queries ──
export function useWorkspaces(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () =>
      api.get<Paginated<Record<string, unknown>>>(
        `/api/workspaces${buildQuery(params ?? {})}`,
      ),
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => api.get<Record<string, unknown>>(`/api/workspaces/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      slug: string;
      description?: string;
    }) => api.post<Record<string, unknown>>("/api/workspaces", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
    }) => api.patch<Record<string, unknown>>(`/api/workspaces/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });
}

export function useArchiveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Record<string, unknown>>(`/api/workspaces/${id}/archive`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });
}
