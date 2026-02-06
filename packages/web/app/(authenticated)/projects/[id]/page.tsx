import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import {
  getProject,
  getTasks,
  getMilestones,
  getRisks,
  getDocumentTree,
  getReportSummary,
} from "@/lib/api/endpoints";
import { ProjectHeader } from "@/components/project/project-header";
import { ProjectSummary } from "@/components/project/project-summary";
import { ProjectTabs } from "@/components/project/project-tabs";
import { TaskTable } from "@/components/project/task-table";
import { MilestoneList } from "@/components/project/milestone-list";
import { RiskTable } from "@/components/project/risk-table";
import { DocumentTree } from "@/components/project/document-tree";
import { ja } from "@/lib/i18n/ja";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [project, tasks, milestones, risks, documents, summary] =
    await Promise.all([
      getProject(id),
      getTasks({ projectId: id, limit: 100 }),
      getMilestones({ projectId: id }),
      getRisks({ projectId: id }),
      getDocumentTree(id).catch(() => []),
      getReportSummary(id).catch(() => ({
        projectId: id,
        total: 0,
        overdue: 0,
        byCategory: [],
        byImportance: [],
      })),
    ]);

  const p = project as Record<string, unknown>;

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
                members: p.members as
                  | { userId: string; role: string }[]
                  | undefined,
              }}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <ProjectTabs
            tasksContent={<TaskTable tasks={tasks.items} />}
            milestonesContent={<MilestoneList milestones={milestones.items} />}
            risksContent={<RiskTable risks={risks.items} />}
            documentsContent={<DocumentTree documents={documents} />}
          />

          <aside>
            <ProjectSummary summary={summary} />
          </aside>
        </div>
      </div>
    </main>
  );
}
