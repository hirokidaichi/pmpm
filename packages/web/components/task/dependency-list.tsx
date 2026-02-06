import Link from "next/link";
import { ja } from "@/lib/i18n/ja";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, ArrowRight, ArrowLeft } from "lucide-react";

interface DependencyListProps {
  predecessors: Record<string, unknown>[];
  successors: Record<string, unknown>[];
}

export function DependencyList({ predecessors, successors }: DependencyListProps) {
  const total = predecessors.length + successors.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-teal-300" />
          {ja.task.dependencies}
          <span className="text-sm font-normal text-white/50">({total})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-white/40">{ja.common.noData}</p>
        ) : (
          <>
            {predecessors.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {ja.task.predecessor}
                </h4>
                <ul className="space-y-1.5">
                  {predecessors.map((dep) => {
                    const taskId = (dep.predecessorTaskId as string) ?? (dep.taskId as string) ?? (dep.id as string);
                    const title = (dep.predecessorTitle as string) ?? (dep.title as string) ?? taskId;
                    return (
                      <li key={taskId}>
                        <Link
                          href={`/tasks/${taskId}`}
                          className="text-sm text-teal-300 hover:text-teal-200 hover:underline"
                        >
                          {title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {successors.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {ja.task.successor}
                </h4>
                <ul className="space-y-1.5">
                  {successors.map((dep) => {
                    const taskId = (dep.successorTaskId as string) ?? (dep.taskId as string) ?? (dep.id as string);
                    const title = (dep.successorTitle as string) ?? (dep.title as string) ?? taskId;
                    return (
                      <li key={taskId}>
                        <Link
                          href={`/tasks/${taskId}`}
                          className="text-sm text-teal-300 hover:text-teal-200 hover:underline"
                        >
                          {title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
