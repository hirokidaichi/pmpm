export const dynamic = "force-dynamic";

import { getWorkspaces } from "@/lib/api/endpoints";
import { WorkspacesContent } from "@/components/workspace/workspaces-content";

export default async function WorkspacesPage() {
  const data = await getWorkspaces({ limit: 50 });

  return <WorkspacesContent initialData={data} />;
}
