import { ja } from "@/lib/i18n/ja";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Target, AlertTriangle } from "lucide-react";

interface ReportCardProps {
  report: Record<string, unknown>;
}

function Section({
  icon: Icon,
  title,
  items,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  iconColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-white/70">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportCard({ report }: ReportCardProps) {
  const reportDate =
    (report.reportDate as string) ?? formatDate(report.createdAt as number);
  const achievements = (report.achievements as string[]) ?? [];
  const plans = (report.plans as string[]) ?? [];
  const issues = (report.issues as string[]) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{reportDate}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section
          icon={CheckCircle2}
          title={ja.daily.achievements}
          items={achievements}
          iconColor="text-emerald-400"
        />
        <Section
          icon={Target}
          title={ja.daily.plans}
          items={plans}
          iconColor="text-teal-400"
        />
        <Section
          icon={AlertTriangle}
          title={ja.daily.issues}
          items={issues}
          iconColor="text-amber-400"
        />
        {achievements.length === 0 && plans.length === 0 && issues.length === 0 && (
          <p className="text-sm text-white/40">{ja.common.noData}</p>
        )}
      </CardContent>
    </Card>
  );
}
