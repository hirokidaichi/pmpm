"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ja } from "@/lib/i18n/ja";
import { formatDate, importanceBadgeColor } from "@/lib/format";
import { CalendarDays, Trash2 } from "lucide-react";
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
import { useDeleteTask } from "@/lib/hooks/use-tasks";
import { EditTaskDialog } from "./edit-task-dialog";

interface TaskHeaderProps {
  task: Record<string, unknown>;
}

export function TaskHeader({ task }: TaskHeaderProps) {
  const router = useRouter();
  const deleteTask = useDeleteTask();

  const importance = (task.importance as string) ?? "NORMAL";
  const stageName =
    (task.stageName as string) ?? (task.stageId as string) ?? "\u2014";
  const dueAt = task.dueAt as number | undefined;
  const taskId = task.id as string;

  async function handleDelete() {
    await deleteTask.mutateAsync(taskId);
    router.push("/");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-none px-3 py-1 text-xs font-semibold ${importanceBadgeColor(importance)}`}
        >
          {ja.importance[importance as keyof typeof ja.importance] ?? importance}
        </span>
        <Badge variant="navy">{stageName}</Badge>
        {dueAt && (
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(dueAt)}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <EditTaskDialog task={task} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-white/60 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[#0f1629]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  タスクを削除
                </AlertDialogTitle>
                <AlertDialogDescription className="text-white/50">
                  このタスクを削除しますか？この操作は元に戻せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  キャンセル
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                  className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                >
                  {deleteTask.isPending ? "削除中..." : "削除"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <h1 className="font-display text-2xl text-white lg:text-3xl">
        {(task.title as string) ?? "Untitled"}
      </h1>
      {typeof task.description === "string" && task.description && (
        <p className="text-sm leading-relaxed text-white/60">
          {task.description}
        </p>
      )}
    </div>
  );
}
