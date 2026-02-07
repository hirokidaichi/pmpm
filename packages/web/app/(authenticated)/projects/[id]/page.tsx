import { notFound } from "next/navigation";
import {
  getProject,
  getTasks,
  getMilestones,
  getRisks,
  getDocumentTree,
  getReportSummary,
} from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { ProjectDetailContent } from "@/components/project/project-detail-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  let project;
  try {
    project = await getProject(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const emptyPaginated = { items: [], total: 0, limit: 50, offset: 0 };
  const [tasks, milestones, risks, documents, summary] = await Promise.all([
    getTasks({ projectId: id, limit: 100 }).catch(() => emptyPaginated),
    getMilestones({ projectId: id }).catch(() => emptyPaginated),
    getRisks({ projectId: id }).catch(() => emptyPaginated),
    getDocumentTree(id).catch(() => []),
    getReportSummary(id).catch(() => ({
      projectId: id,
      total: 0,
      overdue: 0,
      byCategory: [],
      byImportance: [],
    })),
  ]);

  return (
    <ProjectDetailContent
      projectId={id}
      initialProject={project}
      initialTasks={tasks}
      initialMilestones={milestones}
      initialRisks={risks}
      initialDocuments={documents}
      initialSummary={summary}
    />
  );
}
