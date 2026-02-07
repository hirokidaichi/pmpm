"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/endpoints";

// ── Query keys ──
export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...taskKeys.lists(), params] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

// ── Queries ──

export function useTasks(params?: {
  projectId?: string;
  stageId?: string;
  importance?: string;
  assigneeUserId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: taskKeys.list(params ?? {}),
    queryFn: () =>
      api.get<Paginated<Record<string, unknown>>>(
        `/api/tasks${buildQuery(params ?? {})}`,
      ),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => api.get<Record<string, unknown>>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: {
        projectId: string;
        title: string;
        description?: string;
        importance?: string;
        parentTaskId?: string;
        assignees?: { userId: string; role?: string }[];
      },
    ) => api.post<Record<string, unknown>>("/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      description?: string;
      importance?: string;
      stageId?: string;
      dueAt?: number | null;
      startAt?: number | null;
      estimateMinutes?: number | null;
    }) => api.patch<Record<string, unknown>>(`/api/tasks/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ── Assignees ──

export function useAddAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      userId,
      role,
    }: {
      taskId: string;
      userId: string;
      role?: string;
    }) =>
      api.post<Record<string, unknown>>(`/api/tasks/${taskId}/assignees`, {
        userId,
        role,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.taskId),
      });
    },
  });
}

export function useRemoveAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      userId,
    }: {
      taskId: string;
      userId: string;
    }) => api.delete<void>(`/api/tasks/${taskId}/assignees/${userId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.taskId),
      });
    },
  });
}
