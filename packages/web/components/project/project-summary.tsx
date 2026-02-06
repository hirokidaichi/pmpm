import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ja } from "@/lib/i18n/ja";

interface ProjectSummaryProps {
  summary: {
    total: number;
    overdue: number;
    byImportance: { importance: string; count: number }[];
  };
}

const importanceBarColors: Record<string, string> = {
  CRITICAL: "bg-red-400",
  HIGH: "bg-amber-400",
  NORMAL: "bg-teal-400",
  LOW: "bg-white/30",
};

export function ProjectSummary({ summary }: ProjectSummaryProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{ja.project.summary}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-white">{summary.total}</p>
            <p className="text-xs text-white/50">{ja.report.totalTasks}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{summary.overdue}</p>
            <p className="text-xs text-white/50">{ja.report.overdue}</p>
          </div>
        </div>

        {summary.byImportance.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">
              {ja.report.byImportance}
            </p>
            {summary.byImportance.map((item) => (
              <div key={item.importance} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">
                    {(ja.importance as Record<string, string>)[item.importance] ?? item.importance}
                  </span>
                  <span className="text-white/80">{item.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${importanceBarColors[item.importance] ?? "bg-white/30"}`}
                    style={{
                      width: summary.total > 0
                        ? `${(item.count / summary.total) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
