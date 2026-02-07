"use client";

import { ja } from "@/lib/i18n/ja";
import { formatDate, importanceBadgeColor } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, CalendarDays, Gauge, Layers, Clock } from "lucide-react";
import { useUpdateTask } from "@/lib/hooks/use-tasks";
import { AddAssigneeDialog } from "./add-assignee-dialog";

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
  const updateTask = useUpdateTask();

  const taskId = task.id as string;
  const importance = (task.importance as string) ?? "NORMAL";
  const stageName =
    (task.stageName as string) ?? (task.stageId as string) ?? "\u2014";
  const assignees = (task.assignees as Record<string, unknown>[]) ?? [];
  const assigneeName =
    (task.assigneeName as string) ?? (task.assigneeUserId as string);

  function handleImportanceChange(value: string) {
    if (!taskId) return;
    updateTask.mutate({ id: taskId, importance: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assignees with Add button */}
        <SidebarRow icon={User} label={ja.task.assignees}>
          <div className="flex flex-col items-end gap-1">
            <span>
              {assignees.length > 0
                ? assignees
                    .map((a) =>
                      String((a.name as string) ?? (a.userId as string)),
                    )
                    .join(", ")
                : String(assigneeName ?? "\u2014")}
            </span>
            {taskId && <AddAssigneeDialog taskId={taskId} />}
          </div>
        </SidebarRow>

        {/* Importance - inline select */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Gauge className="h-4 w-4" />
            <span>{ja.task.importance}</span>
          </div>
          <Select value={importance} onValueChange={handleImportanceChange}>
            <SelectTrigger className="h-7 w-auto min-w-[80px] border-white/10 bg-white/5 text-xs">
              <SelectValue>
                <span
                  className={`inline-flex items-center rounded-none px-2 py-0.5 text-xs font-semibold ${importanceBadgeColor(importance)}`}
                >
                  {ja.importance[
                    importance as keyof typeof ja.importance
                  ] ?? importance}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0f1629]">
              <SelectItem value="LOW">{ja.importance.LOW}</SelectItem>
              <SelectItem value="NORMAL">{ja.importance.NORMAL}</SelectItem>
              <SelectItem value="HIGH">{ja.importance.HIGH}</SelectItem>
              <SelectItem value="CRITICAL">
                {ja.importance.CRITICAL}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stage - display (inline select would require available stages data) */}
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
