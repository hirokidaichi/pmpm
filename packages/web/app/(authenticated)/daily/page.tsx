export const dynamic = "force-dynamic";

import { ja } from "@/lib/i18n/ja";
import { getDailyReports } from "@/lib/api/endpoints";
import { ReportCard } from "@/components/daily/report-card";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, FileText } from "lucide-react";

export default async function DailyPage() {
  const data = await getDailyReports({ limit: 30 });
  const reports = data.items;

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">{ja.daily.title}</h1>
            <p className="text-sm text-white/50">
              {ja.common.total}: {data.total}
            </p>
          </div>
        </header>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-4 h-12 w-12 text-white/20" />
              <p className="text-sm text-white/40">{ja.daily.noDailyReports}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => (
              <ReportCard
                key={(report.id as string) ?? (report.reportDate as string)}
                report={report}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
