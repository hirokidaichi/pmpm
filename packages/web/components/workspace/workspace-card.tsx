import Link from "next/link";
import { Users2, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    createdAt?: number | null;
    archivedAt?: number | null;
  };
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  return (
    <Link href={`/workspaces/${workspace.id}`} className="block group">
      <Card className="glass transition-all duration-200 hover:border-teal-400/30 hover:bg-white/[0.08]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="group-hover:text-teal-200 transition-colors">
              {workspace.name}
            </CardTitle>
            {workspace.archivedAt && (
              <Badge variant="navy">archived</Badge>
            )}
          </div>
          <CardDescription className="font-mono text-xs">
            {workspace.slug}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.description && (
            <p className="text-sm text-white/60 line-clamp-2">
              {workspace.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {ja.workspace.created} {formatDate(workspace.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
