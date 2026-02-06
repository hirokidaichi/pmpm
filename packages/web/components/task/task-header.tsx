import { Badge } from "@/components/ui/badge";
import { ja } from "@/lib/i18n/ja";
import { formatDate, importanceBadgeColor } from "@/lib/format";
import { CalendarDays } from "lucide-react";

interface TaskHeaderProps {
  task: Record<string, unknown>;
}

export function TaskHeader({ task }: TaskHeaderProps) {
  const importance = (task.importance as string) ?? "NORMAL";
  const stageName = (task.stageName as string) ?? (task.stageId as string) ?? "—";
  const dueAt = task.dueAt as number | undefined;

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
