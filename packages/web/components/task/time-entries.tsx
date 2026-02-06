import { ja } from "@/lib/i18n/ja";
import { formatDate, formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock } from "lucide-react";

interface TimeEntriesProps {
  entries: Record<string, unknown>[];
}

export function TimeEntries({ entries }: TimeEntriesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-teal-300" />
          {ja.task.timeEntries}
          <span className="text-sm font-normal text-white/50">({entries.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-white/40">{ja.common.noData}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">{ja.daily.reportDate}</TableHead>
                <TableHead className="text-white/50">{ja.task.timeEntries}</TableHead>
                <TableHead className="text-white/50">{ja.task.comments}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={(entry.id as string) ?? index} className="border-white/10">
                  <TableCell className="text-sm text-white/70">
                    {formatDate((entry.startedAt as number) ?? (entry.createdAt as number))}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-teal-300">
                    {formatDuration((entry.minutes as number) ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm text-white/50">
                    {(entry.comment as string) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
