"use client";

import {
  FolderKanban,
  Layers,
  ListChecks,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

interface StatsCardsProps {
  workspaceCount: number | null;
  projectCount: number | null;
  taskCount: number | null;
  inboxUnread: number | null;
}

export function StatsCards({
  workspaceCount,
  projectCount,
  taskCount,
  inboxUnread,
}: StatsCardsProps) {
  const { t } = useI18n();

  const items = [
    {
      label: t.dashboard.stats.workspaces,
      value: workspaceCount,
      icon: FolderKanban,
    },
    {
      label: t.dashboard.stats.projects,
      value: projectCount,
      icon: Layers,
    },
    {
      label: t.dashboard.stats.openTasks,
      value: taskCount,
      icon: ListChecks,
    },
    {
      label: t.nav.inbox,
      value: inboxUnread,
      icon: Inbox,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </CardDescription>
              <CardTitle className="text-3xl">
                {item.value !== null ? item.value : "\u2014"}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        );
      })}
    </div>
  );
}
