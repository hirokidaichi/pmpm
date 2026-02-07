"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Clock, Plus, Trash2 } from "lucide-react";
import { useDeleteTimeEntry } from "@/lib/hooks/use-time";
import { LogTimeDialog } from "./log-time-dialog";

interface TimeEntriesProps {
  entries: Record<string, unknown>[];
  taskId?: string;
}

export function TimeEntries({ entries: initialEntries, taskId }: TimeEntriesProps) {
  const { t } = useI18n();
  const [logOpen, setLogOpen] = useState(false);
  const { deleteTimeEntry } = useDeleteTimeEntry();
  const [items, setItems] = useState(initialEntries);

  const handleRefresh = async () => {
    if (!taskId) return;
    try {
      const { api, buildQuery } = await import("@/lib/api/client");
      const data = await api.get<{ items: Record<string, unknown>[] }>(
        `/api/time/entries${buildQuery({ taskId, limit: 100 })}`,
      );
      setItems(data.items);
    } catch {
      // silently handle
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTimeEntry(id);
    handleRefresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-300" />
            {t.task.timeEntries}
            <span className="text-sm font-normal text-white/50">({items.length})</span>
          </CardTitle>
          {taskId && (
            <Button size="sm" onClick={() => setLogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t.time.logTime}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-white/40">{t.common.noData}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">{t.daily.reportDate}</TableHead>
                <TableHead className="text-white/50">{t.task.timeEntries}</TableHead>
                <TableHead className="text-white/50">{t.task.comments}</TableHead>
                {taskId && <TableHead className="text-white/50 w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry, index) => {
                const entryId = (entry.id as string) ?? String(index);
                return (
                  <TableRow key={entryId} className="border-white/10">
                    <TableCell className="text-sm text-white/70">
                      {formatDate((entry.startedAt as number) ?? (entry.createdAt as number))}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-teal-300">
                      {formatDuration((entry.minutes as number) ?? 0)}
                    </TableCell>
                    <TableCell className="text-sm text-white/50">
                      {(entry.comment as string) ?? "\u2014"}
                    </TableCell>
                    {taskId && (
                      <TableCell>
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
                                {t.time.deleteConfirm}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="text-white/60">
                                {t.common.cancel}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(entryId)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t.common.delete}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {taskId && (
        <LogTimeDialog
          taskId={taskId}
          open={logOpen}
          onOpenChange={setLogOpen}
          onLogged={handleRefresh}
        />
      )}
    </Card>
  );
}
