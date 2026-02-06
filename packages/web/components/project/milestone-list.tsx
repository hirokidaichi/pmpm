import { Calendar, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, milestoneStatusColor } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

const milestoneStatusLabel: Record<string, string> = {
  OPEN: ja.milestone.open,
  COMPLETED: ja.milestone.completed,
  MISSED: ja.milestone.missed,
};

interface MilestoneListProps {
  milestones: Record<string, unknown>[];
}

export function MilestoneList({ milestones }: MilestoneListProps) {
  if (milestones.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{ja.milestone.noMilestones}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {milestones.map((ms) => {
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
                {status && (
                  <Badge className={milestoneStatusColor(status)}>
                    {milestoneStatusLabel[status] ?? status}
                  </Badge>
                )}
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
                  {ja.common.dueAt}: {formatDate(dueAt)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
