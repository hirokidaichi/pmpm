import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, importanceBadgeColor } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

interface TaskTableProps {
  tasks: Record<string, unknown>[];
}

export function TaskTable({ tasks }: TaskTableProps) {
  if (tasks.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{ja.task.noTasks}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/50">{ja.task.title}</TableHead>
            <TableHead className="text-white/50">{ja.task.importance}</TableHead>
            <TableHead className="text-white/50">{ja.task.stage}</TableHead>
            <TableHead className="text-white/50">{ja.task.assignees}</TableHead>
            <TableHead className="text-white/50">{ja.common.dueAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const id = task.id as string;
            const title = task.title as string;
            const importance = task.importance as string | undefined;
            const stageId = task.stageId as string | undefined;
            const assignees = task.assignees as { userId: string }[] | undefined;
            const dueAt = task.dueAt as number | undefined;

            return (
              <TableRow key={id} className="border-white/5 hover:bg-white/5">
                <TableCell>
                  <Link
                    href={`/tasks/${id}`}
                    className="text-sm text-white hover:text-teal-200 transition-colors"
                  >
                    {title}
                  </Link>
                </TableCell>
                <TableCell>
                  {importance && (
                    <Badge className={importanceBadgeColor(importance)}>
                      {(ja.importance as Record<string, string>)[importance] ?? importance}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-white/60">
                  {stageId ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-white/60">
                  {assignees && assignees.length > 0
                    ? `${assignees.length}${ja.task.assignees}`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-white/60">
                  {formatDate(dueAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
