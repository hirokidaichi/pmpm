import Link from "next/link";
import { ArrowLeft, Layers, FolderOpen, Calendar } from "lucide-react";
import { getWorkspace, getProjects } from "@/lib/api/endpoints";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, statusBadgeColor } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [workspace, projects] = await Promise.all([
    getWorkspace(id),
    getProjects({ workspaceId: id, limit: 100 }),
  ]);

  const ws = workspace as Record<string, unknown>;
  const wsName = ws.name as string;
  const wsSlug = ws.slug as string;
  const wsDescription = ws.description as string | undefined;

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <Link
            href="/workspaces"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {ja.workspace.title}
          </Link>

          <header className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white">
                {wsName}
              </h1>
              <p className="font-mono text-sm text-white/50">
                {wsSlug}
              </p>
            </div>
          </header>

          {wsDescription && (
            <p className="mt-4 text-sm text-white/60 max-w-2xl">
              {wsDescription}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {ja.workspace.created} {formatDate(ws.createdAt as number | undefined)}
            </span>
          </div>
        </div>

        <section>
          <h2 className="mb-4 font-display text-xl text-white">
            {ja.workspace.projects}
          </h2>

          {projects.items.length === 0 ? (
            <Card className="glass">
              <CardContent className="flex items-center justify-center py-16">
                <p className="text-white/50">{ja.project.noProjects}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.items.map((p: Record<string, unknown>) => {
                const pId = p.id as string;
                const pName = p.name as string;
                const pKey = p.key as string | undefined;
                const pStatus = p.status as string | undefined;
                const pDueAt = p.dueAt as number | undefined;

                return (
                  <Link
                    key={pId}
                    href={`/projects/${pId}`}
                    className="block group"
                  >
                    <Card className="glass transition-all duration-200 hover:border-teal-400/30 hover:bg-white/[0.08]">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="group-hover:text-teal-200 transition-colors">
                            {pName}
                          </CardTitle>
                          {pStatus && (
                            <Badge
                              className={statusBadgeColor(pStatus)}
                            >
                              {(ja.status as Record<string, string>)[pStatus] ?? pStatus}
                            </Badge>
                          )}
                        </div>
                        {pKey && (
                          <CardDescription className="font-mono text-xs">
                            {pKey}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-xs text-white/40">
                          <span className="flex items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5" />
                            {ja.project.title}
                          </span>
                          {pDueAt && (
                            <span>
                              {ja.project.dueDate}: {formatDate(pDueAt)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
