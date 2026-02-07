"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/endpoints";

// ── Query keys ──
const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// ── Queries ──
export function useProjects(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () =>
      api.get<Paginated<Record<string, unknown>>>(
        `/api/projects${buildQuery(params ?? {})}`,
      ),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get<Record<string, unknown>>(`/api/projects/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      name: string;
      key: string;
      description?: string;
    }) => api.post<Record<string, unknown>>("/api/projects", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      status?: string;
    }) => api.patch<Record<string, unknown>>(`/api/projects/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Record<string, unknown>>(`/api/projects/${id}/archive`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      ...data
    }: {
      projectId: string;
      userId: string;
      role: string;
      title?: string;
    }) =>
      api.post<Record<string, unknown>>(
        `/api/projects/${projectId}/members`,
        data,
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
    }: {
      projectId: string;
      userId: string;
    }) =>
      api.delete<void>(`/api/projects/${projectId}/members/${userId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
    },
  });
}
