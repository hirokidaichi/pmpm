import { ja } from "@/lib/i18n/ja";
import { formatDate, importanceBadgeColor } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, CalendarDays, Gauge, Layers, Clock } from "lucide-react";

interface TaskSidebarProps {
  task: Record<string, unknown>;
}

function SidebarRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="text-right text-sm text-white/80">{children}</div>
    </div>
  );
}

export function TaskSidebar({ task }: TaskSidebarProps) {
  const importance = (task.importance as string) ?? "NORMAL";
  const stageName = (task.stageName as string) ?? (task.stageId as string) ?? "—";
  const assignees = (task.assignees as Record<string, unknown>[]) ?? [];
  const assigneeName = (task.assigneeName as string) ?? (task.assigneeUserId as string);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SidebarRow icon={User} label={ja.task.assignees}>
          {assignees.length > 0
            ? assignees.map((a) => String((a.name as string) ?? (a.userId as string))).join(", ")
            : String(assigneeName ?? "—")}
        </SidebarRow>

        <SidebarRow icon={Gauge} label={ja.task.importance}>
          <span
            className={`inline-flex items-center rounded-none px-2 py-0.5 text-xs font-semibold ${importanceBadgeColor(importance)}`}
          >
            {ja.importance[importance as keyof typeof ja.importance] ?? importance}
          </span>
        </SidebarRow>

        <SidebarRow icon={Layers} label={ja.task.stage}>
          {stageName}
        </SidebarRow>

        <SidebarRow icon={CalendarDays} label={ja.project.startDate}>
          {formatDate(task.startAt as number | undefined)}
        </SidebarRow>

        <SidebarRow icon={CalendarDays} label={ja.common.dueAt}>
          {formatDate(task.dueAt as number | undefined)}
        </SidebarRow>

        {typeof task.estimateMinutes === "number" && (
          <SidebarRow icon={Clock} label="Estimate">
            {Math.round(task.estimateMinutes / 60)}h
          </SidebarRow>
        )}

        <SidebarRow icon={Clock} label={ja.common.createdAt}>
          {formatDate(task.createdAt as number | undefined)}
        </SidebarRow>

        <SidebarRow icon={Clock} label={ja.common.updatedAt}>
          {formatDate(task.updatedAt as number | undefined)}
        </SidebarRow>
      </CardContent>
    </Card>
  );
}
