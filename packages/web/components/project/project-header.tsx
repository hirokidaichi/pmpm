import { Calendar, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, statusBadgeColor } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

interface ProjectHeaderProps {
  project: {
    name: string;
    key?: string | null;
    description?: string | null;
    status?: string | null;
    startAt?: number | null;
    dueAt?: number | null;
    members?: { userId: string; role: string }[];
  };
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-white">{project.name}</h1>
        {project.key && (
          <Badge variant="navy" className="font-mono text-xs">
            {project.key}
          </Badge>
        )}
        {project.status && (
          <Badge className={statusBadgeColor(project.status)}>
            {(ja.status as Record<string, string>)[project.status] ?? project.status}
          </Badge>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-white/60 max-w-2xl">{project.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-5 text-xs text-white/40">
        {project.startAt && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {ja.project.startDate}: {formatDate(project.startAt)}
          </span>
        )}
        {project.dueAt && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {ja.project.dueDate}: {formatDate(project.dueAt)}
          </span>
        )}
        {project.members && project.members.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5" />
            {project.members.length} {ja.workspace.members}
          </span>
        )}
      </div>
    </div>
  );
}
