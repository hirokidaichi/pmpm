"use client";

import { useState } from "react";
import { Calendar, Flag, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatDate, milestoneStatusColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMilestones, useDeleteMilestone, useUpdateMilestone } from "@/lib/hooks/use-milestones";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { EditMilestoneDialog } from "./edit-milestone-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MILESTONE_STATUSES = ["OPEN", "COMPLETED", "MISSED"] as const;

interface MilestoneListProps {
  milestones: Record<string, unknown>[];
  projectId?: string;
}

export function MilestoneList({ milestones: initialMilestones, projectId }: MilestoneListProps) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const { deleteMilestone } = useDeleteMilestone();
  const { updateMilestone } = useUpdateMilestone();
  const [items, setItems] = useState(initialMilestones);

  const statusLabels: Record<string, string> = {
    OPEN: t.milestone.open,
    COMPLETED: t.milestone.completed,
    MISSED: t.milestone.missed,
  };

  const handleRefresh = async () => {
    if (!projectId) return;
    try {
      const { api, buildQuery } = await import("@/lib/api/client");
      const data = await api.get<{ items: Record<string, unknown>[] }>(
        `/api/milestones${buildQuery({ projectId, limit: 100 })}`,
      );
      setItems(data.items);
    } catch {
      // silently handle
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMilestone(id);
    handleRefresh();
  };

  const handleInlineStatusChange = async (id: string, status: string) => {
    await updateMilestone(id, { status });
    handleRefresh();
  };

  if (items.length === 0 && !projectId) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{t.milestone.noMilestones}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projectId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t.milestone.create}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-white/50">{t.milestone.noMilestones}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((ms) => {
            const id = ms.id as string;
            const name = ms.name as string;
            const description = ms.description as string | undefined;
            const status = ms.status as string | undefined;
            const dueAt = ms.dueAt as number | undefined;

            return (
              <Card key={id} className="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-teal-300" />
                      {name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {projectId && status && (
                        <Select
                          value={status}
                          onValueChange={(v) => handleInlineStatusChange(id, v)}
                        >
                          <SelectTrigger className={`h-7 w-auto gap-1 border-0 px-2 text-xs ${milestoneStatusColor(status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-navy-900">
                            {MILESTONE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {statusLabels[s] ?? s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!projectId && status && (
                        <Badge className={milestoneStatusColor(status)}>
                          {statusLabels[status] ?? status}
                        </Badge>
                      )}
                      {projectId && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white/50 hover:bg-white/10"
                            onClick={() => setEditTarget(ms)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="glass-strong border-white/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  {t.common.confirm}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/50">
                                  {t.milestone.deleteConfirm}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-white/60">
                                  {t.common.cancel}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {t.common.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {description && (
                    <p className="text-sm text-white/60 line-clamp-2">
                      {description}
                    </p>
                  )}
                  {dueAt && (
                    <p className="flex items-center gap-1.5 text-xs text-white/40">
                      <Calendar className="h-3.5 w-3.5" />
                      {t.common.dueAt}: {formatDate(dueAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {projectId && (
        <>
          <CreateMilestoneDialog
            projectId={projectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleRefresh}
          />
          {editTarget && (
            <EditMilestoneDialog
              milestone={editTarget}
              open={!!editTarget}
              onOpenChange={(open) => {
                if (!open) setEditTarget(null);
              }}
              onUpdated={handleRefresh}
            />
          )}
        </>
      )}
    </div>
  );
}
