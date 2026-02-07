"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { taskKeys } from "./use-tasks";

// ── Query keys ──
export const dependencyKeys = {
  all: ["dependencies"] as const,
  task: (taskId: string) => [...dependencyKeys.all, "task", taskId] as const,
};

// ── Queries ──

export function useTaskDependencies(taskId: string) {
  return useQuery({
    queryKey: dependencyKeys.task(taskId),
    queryFn: () =>
      api.get<{
        predecessors: Record<string, unknown>[];
        successors: Record<string, unknown>[];
      }>(`/api/dependencies/task/${taskId}`),
    enabled: !!taskId,
  });
}

// ── Mutations ──

export function useCreateDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      predecessorTaskId: string;
      successorTaskId: string;
      dependencyType?: string;
    }) => api.post<Record<string, unknown>>("/api/dependencies", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.task(variables.predecessorTaskId),
      });
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.task(variables.successorTaskId),
      });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dependencyId,
      taskId,
    }: {
      dependencyId: string;
      taskId: string;
    }) => api.delete<void>(`/api/dependencies/${dependencyId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.task(variables.taskId),
      });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
