"use client";

import Link from "next/link";
import { ja } from "@/lib/i18n/ja";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, ArrowRight, ArrowLeft, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteDependency } from "@/lib/hooks/use-dependencies";
import { AddDependencyDialog } from "./add-dependency-dialog";

interface DependencyListProps {
  predecessors: Record<string, unknown>[];
  successors: Record<string, unknown>[];
  taskId: string;
}

function DependencyItem({
  dep,
  taskId: currentTaskId,
  isPredecessor,
}: {
  dep: Record<string, unknown>;
  taskId: string;
  isPredecessor: boolean;
}) {
  const deleteDependency = useDeleteDependency();
  const depId = (dep.dependencyId as string) ?? (dep.id as string);

  const targetTaskId = isPredecessor
    ? ((dep.predecessorTaskId as string) ?? (dep.taskId as string) ?? (dep.id as string))
    : ((dep.successorTaskId as string) ?? (dep.taskId as string) ?? (dep.id as string));

  const title = isPredecessor
    ? ((dep.predecessorTitle as string) ?? (dep.title as string) ?? targetTaskId)
    : ((dep.successorTitle as string) ?? (dep.title as string) ?? targetTaskId);

  async function handleDelete() {
    if (!depId) return;
    await deleteDependency.mutateAsync({
      dependencyId: depId,
      taskId: currentTaskId,
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 group">
      <Link
        href={`/tasks/${targetTaskId}`}
        className="text-sm text-teal-300 hover:text-teal-200 hover:underline truncate"
      >
        {title}
      </Link>
      {depId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-opacity"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#0f1629]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                依存関係を削除
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/50">
                この依存関係を削除しますか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
              >
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}

export function DependencyList({
  predecessors,
  successors,
  taskId,
}: DependencyListProps) {
  const total = predecessors.length + successors.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-teal-300" />
          {ja.task.dependencies}
          <span className="text-sm font-normal text-white/50">({total})</span>
          <div className="ml-auto">
            <AddDependencyDialog taskId={taskId} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-white/40">{ja.common.noData}</p>
        ) : (
          <>
            {predecessors.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {ja.task.predecessor}
                </h4>
                <ul className="space-y-1.5">
                  {predecessors.map((dep, index) => {
                    const key =
                      (dep.dependencyId as string) ??
                      (dep.predecessorTaskId as string) ??
                      (dep.id as string) ??
                      index;
                    return (
                      <DependencyItem
                        key={key}
                        dep={dep}
                        taskId={taskId}
                        isPredecessor
                      />
                    );
                  })}
                </ul>
              </div>
            )}
            {successors.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {ja.task.successor}
                </h4>
                <ul className="space-y-1.5">
                  {successors.map((dep, index) => {
                    const key =
                      (dep.dependencyId as string) ??
                      (dep.successorTaskId as string) ??
                      (dep.id as string) ??
                      index;
                    return (
                      <DependencyItem
                        key={key}
                        dep={dep}
                        taskId={taskId}
                        isPredecessor={false}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
