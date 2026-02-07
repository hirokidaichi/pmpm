"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useDailyReports, useDeleteDaily } from "@/lib/hooks/use-daily";
import { ReportCard } from "@/components/daily/report-card";
import { CreateDailyDialog } from "@/components/daily/create-daily-dialog";
import { EditDailyDialog } from "@/components/daily/edit-daily-dialog";
import { Card, CardContent } from "@/components/ui/card";
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
import { CalendarDays, FileText, Plus, Pencil, Trash2 } from "lucide-react";

export default function DailyPage() {
  const { t } = useI18n();
  const { reports, total, loading, refresh } = useDailyReports({ limit: 30 });
  const { deleteDaily } = useDeleteDaily();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);

  const handleDelete = async (id: string) => {
    await deleteDaily(id);
    refresh();
  };

  if (loading) {
    return (
      <main className="px-6 pb-20 pt-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center py-20">
          <p className="text-white/40">{t.common.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl text-white">{t.daily.title}</h1>
            <p className="text-sm text-white/50">
              {t.common.total}: {total}
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t.daily.create}
          </Button>
        </header>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-4 h-12 w-12 text-white/20" />
              <p className="text-sm text-white/40">{t.daily.noDailyReports}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => {
              const id = (report.id as string) ?? (report.reportDate as string);
              return (
                <div key={id} className="relative group">
                  <ReportCard report={report} />
                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/50 hover:bg-white/10"
                      onClick={() => setEditTarget(report)}
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
                            {t.daily.deleteConfirm}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-white/60">
                            {t.common.cancel}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(report.id as string)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t.common.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateDailyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
      {editTarget && (
        <EditDailyDialog
          report={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onUpdated={refresh}
        />
      )}
    </main>
  );
}
