"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  getProjects,
  getReportSummary,
  getReportWorkload,
  getReportTime,
} from "@/lib/api/endpoints";
import { formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Users, Clock, FileText } from "lucide-react";

interface SummaryData {
  projectId: string;
  total: number;
  overdue: number;
  byCategory: { category: string; count: number }[];
  byImportance: { importance: string; count: number }[];
}

interface WorkloadItem {
  userId: string;
  count: number;
}

interface TimeItem {
  userId: string;
  totalMinutes: number;
  entryCount: number;
}

const importanceBarColors: Record<string, string> = {
  LOW: "bg-white/20",
  NORMAL: "bg-teal-500",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

export default function ReportsPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [timeData, setTimeData] = useState<TimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects({ limit: 100 })
      .then((res) => {
        setProjects(res.items);
        if (res.items.length > 0) {
          setSelectedProjectId(res.items[0].id as string);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    Promise.all([
      getReportSummary(selectedProjectId).catch(() => null),
      getReportWorkload(selectedProjectId).catch(() => []),
      getReportTime({ projectId: selectedProjectId }).catch(() => []),
    ])
      .then(([s, w, tm]) => {
        setSummary(s);
        setWorkload(w);
        setTimeData(tm);
      })
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const maxWorkload = Math.max(...workload.map((w) => w.count), 1);
  const maxTime = Math.max(...timeData.map((t) => t.totalMinutes), 1);

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl text-white">{t.report.title}</h1>
          </div>
          <div className="w-64">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="glass border-white/10 text-white">
                <SelectValue placeholder={t.project.title} />
              </SelectTrigger>
              <SelectContent className="glass border-white/10 bg-[#0b1020]">
                {projects.map((p) => (
                  <SelectItem key={p.id as string} value={p.id as string}>
                    {(p.name as string) ?? (p.id as string)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-white/40">{t.common.loading}</p>
          </div>
        ) : !selectedProjectId ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-4 h-12 w-12 text-white/20" />
              <p className="text-sm text-white/40">{t.report.noData}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Summary panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-300" />
                  {t.report.summary}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-none border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-wider text-white/50">
                          {t.report.totalTasks}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-white">
                          {summary.total}
                        </p>
                      </div>
                      <div className="rounded-none border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-wider text-white/50">
                          {t.report.overdue}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-red-400">
                          {summary.overdue}
                        </p>
                      </div>
                    </div>

                    {summary.byImportance.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-sm font-medium text-white/60">
                          {t.report.byImportance}
                        </h4>
                        <div className="space-y-2">
                          {summary.byImportance.map((item) => (
                            <div key={item.importance} className="flex items-center gap-3">
                              <span className="w-16 text-xs text-white/50">
                                {t.importance[item.importance as keyof typeof t.importance] ??
                                  item.importance}
                              </span>
                              <div className="flex-1">
                                <div
                                  className={`h-5 rounded-none ${importanceBarColors[item.importance] ?? "bg-white/20"}`}
                                  style={{
                                    width: `${Math.max((item.count / summary.total) * 100, 4)}%`,
                                  }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs text-white/70">
                                {item.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {summary.byCategory.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-sm font-medium text-white/60">
                          {t.report.byCategory}
                        </h4>
                        <div className="space-y-2">
                          {summary.byCategory.map((item) => (
                            <div key={item.category} className="flex items-center gap-3">
                              <span className="w-24 truncate text-xs text-white/50">
                                {item.category}
                              </span>
                              <div className="flex-1">
                                <div
                                  className="h-5 rounded-none bg-teal-500/60"
                                  style={{
                                    width: `${Math.max((item.count / summary.total) * 100, 4)}%`,
                                  }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs text-white/70">
                                {item.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">{t.report.noData}</p>
                )}
              </CardContent>
            </Card>

            {/* Workload panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-300" />
                  {t.report.workload}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workload.length === 0 ? (
                  <p className="text-sm text-white/40">{t.report.noData}</p>
                ) : (
                  <div className="space-y-3">
                    {workload.map((item) => (
                      <div key={item.userId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm text-white/70">
                            {item.userId}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {item.count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-none bg-white/10">
                          <div
                            className="h-full rounded-none bg-teal-500"
                            style={{
                              width: `${(item.count / maxWorkload) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Time panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-300" />
                  {t.report.timeReport}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeData.length === 0 ? (
                  <p className="text-sm text-white/40">{t.report.noData}</p>
                ) : (
                  <div className="space-y-3">
                    {timeData.map((item) => (
                      <div key={item.userId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm text-white/70">
                            {item.userId}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {formatDuration(item.totalMinutes)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-none bg-white/10">
                          <div
                            className="h-full rounded-none bg-amber-500"
                            style={{
                              width: `${(item.totalMinutes / maxTime) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
