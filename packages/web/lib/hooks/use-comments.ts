"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/endpoints";

// ── Query keys ──
export const commentKeys = {
  all: ["comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  list: (taskId: string, params?: Record<string, unknown>) =>
    [...commentKeys.lists(), taskId, params ?? {}] as const,
};

// ── Queries ──

export function useComments(
  taskId: string,
  params?: { limit?: number; offset?: number; order?: string },
) {
  return useQuery({
    queryKey: commentKeys.list(taskId, params),
    queryFn: () =>
      api.get<Paginated<Record<string, unknown>>>(
        `/api/tasks/${taskId}/comments${buildQuery(params ?? {})}`,
      ),
    enabled: !!taskId,
  });
}

// ── Mutations ──

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      taskId: string;
      body: string;
    }) =>
      api.post<Record<string, unknown>>(`/api/tasks/${taskId}/comments`, {
        body,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.taskId),
      });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      commentId,
      body,
    }: {
      taskId: string;
      commentId: string;
      body: string;
    }) =>
      api.patch<Record<string, unknown>>(
        `/api/tasks/${taskId}/comments/${commentId}`,
        { body },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.taskId),
      });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      commentId,
    }: {
      taskId: string;
      commentId: string;
    }) => api.delete<void>(`/api/tasks/${taskId}/comments/${commentId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.taskId),
      });
    },
  });
}
