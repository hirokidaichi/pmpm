"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderOpen, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectHeader } from "@/components/project/project-header";
import { ProjectSummary } from "@/components/project/project-summary";
import { ProjectTabs } from "@/components/project/project-tabs";
import { TaskTable } from "@/components/project/task-table";
import { MilestoneList } from "@/components/project/milestone-list";
import { RiskTable } from "@/components/project/risk-table";
import { DocumentTree } from "@/components/project/document-tree";
import { EditProjectDialog } from "@/components/project/edit-project-dialog";
import { ArchiveProjectDialog } from "@/components/project/archive-project-dialog";
import { AddMemberDialog } from "@/components/project/add-member-dialog";
import { RemoveMemberDialog } from "@/components/project/remove-member-dialog";
import { useProject } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";
import type { Paginated } from "@/lib/api/endpoints";

interface ProjectDetailContentProps {
  projectId: string;
  initialProject: Record<string, unknown>;
  initialTasks: Paginated<Record<string, unknown>>;
  initialMilestones: Paginated<Record<string, unknown>>;
  initialRisks: Paginated<Record<string, unknown>>;
  initialDocuments: Record<string, unknown>[];
  initialSummary: {
    projectId: string;
    total: number;
    overdue: number;
    byCategory: { category: string; count: number }[];
    byImportance: { importance: string; count: number }[];
  };
}

export function ProjectDetailContent({
  projectId,
  initialProject,
  initialTasks,
  initialMilestones,
  initialRisks,
  initialDocuments,
  initialSummary,
}: ProjectDetailContentProps) {
  const router = useRouter();
  const { data: projData } = useProject(projectId);

  const p = (projData ?? initialProject) as Record<string, unknown>;
  const members = (p.members as { userId: string; role: string }[]) ?? [];

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <Link
            href={
              p.workspaceId
                ? `/workspaces/${p.workspaceId as string}`
                : "/workspaces"
            }
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {ja.common.back}
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-none bg-teal-500/20 text-teal-200 shrink-0 mt-1">
                <FolderOpen className="h-6 w-6" />
              </div>
              <ProjectHeader
                project={{
                  name: p.name as string,
                  key: p.key as string | null | undefined,
                  description: p.description as string | null | undefined,
                  status: p.status as string | null | undefined,
                  startAt: p.startAt as number | null | undefined,
                  dueAt: p.dueAt as number | null | undefined,
                  members,
                }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <EditProjectDialog
                project={{
                  id: projectId,
                  name: p.name as string,
                  description: p.description as string | null | undefined,
                  status: p.status as string | null | undefined,
                }}
              />
              <ArchiveProjectDialog
                projectId={projectId}
                projectName={p.name as string}
                onArchived={() => {
                  const wsId = p.workspaceId as string | undefined;
                  router.push(wsId ? `/workspaces/${wsId}` : "/workspaces");
                }}
              />
            </div>
          </div>
        </div>

        {/* Members section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg text-white">
              <Users2 className="h-5 w-5 text-white/50" />
              {ja.workspace.members}
              {members.length > 0 && (
                <span className="text-sm text-white/40">
                  ({members.length})
                </span>
              )}
            </h2>
            <AddMemberDialog projectId={projectId} />
          </div>
          {members.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-2 rounded-none border border-white/10 bg-white/5 px-3 py-1.5"
                >
                  <span className="text-sm text-white/80">{m.userId}</span>
                  <Badge
                    variant="navy"
                    className="text-[10px] uppercase tracking-wider"
                  >
                    {(ja.memberRole as Record<string, string>)[m.role] ??
                      m.role}
                  </Badge>
                  <RemoveMemberDialog
                    projectId={projectId}
                    userId={m.userId}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Card className="glass">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-white/40">{ja.common.noData}</p>
              </CardContent>
            </Card>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <ProjectTabs
            tasksContent={<TaskTable tasks={initialTasks.items} />}
            milestonesContent={
              <MilestoneList
                milestones={initialMilestones.items}
                projectId={projectId}
              />
            }
            risksContent={
              <RiskTable risks={initialRisks.items} projectId={projectId} />
            }
            documentsContent={
              <DocumentTree
                documents={initialDocuments}
                projectId={projectId}
              />
            }
          />

          <aside>
            <ProjectSummary summary={initialSummary} />
          </aside>
        </div>
      </div>
    </main>
  );
}
