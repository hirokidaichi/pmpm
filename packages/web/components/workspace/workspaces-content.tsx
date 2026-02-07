"use client";

import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { ja } from "@/lib/i18n/ja";
import type { Paginated } from "@/lib/api/endpoints";

interface WorkspacesContentProps {
  initialData: Paginated<Record<string, unknown>>;
}

export function WorkspacesContent({ initialData }: WorkspacesContentProps) {
  const { data } = useWorkspaces({ limit: 50 });
  const workspaces = data ?? initialData;

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                pmpm
              </p>
              <h1 className="font-display text-3xl text-white">
                {ja.workspace.title}
              </h1>
            </div>
          </div>
          <CreateWorkspaceDialog />
        </header>

        {workspaces.items.length === 0 ? (
          <Card className="glass">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-white/50">{ja.workspace.noWorkspaces}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.items.map((ws: Record<string, unknown>) => (
              <WorkspaceCard
                key={ws.id as string}
                workspace={{
                  id: ws.id as string,
                  name: ws.name as string,
                  slug: ws.slug as string,
                  description: ws.description as string | null | undefined,
                  createdAt: ws.createdAt as number | null | undefined,
                  archivedAt: ws.archivedAt as number | null | undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
