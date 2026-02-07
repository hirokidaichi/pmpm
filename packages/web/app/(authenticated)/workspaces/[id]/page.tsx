import { notFound } from "next/navigation";
import { getWorkspace, getProjects } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { WorkspaceDetailContent } from "@/components/workspace/workspace-detail-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const { id } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const projects = await getProjects({ workspaceId: id, limit: 100 }).catch(
    () => ({ items: [], total: 0, limit: 100, offset: 0 }),
  );

  return (
    <WorkspaceDetailContent
      workspaceId={id}
      initialWorkspace={workspace}
      initialProjects={projects}
    />
  );
}
