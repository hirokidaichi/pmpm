"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

interface ProjectTabsProps {
  tasksContent: React.ReactNode;
  milestonesContent: React.ReactNode;
  risksContent: React.ReactNode;
  documentsContent: React.ReactNode;
}

export function ProjectTabs({
  tasksContent,
  milestonesContent,
  risksContent,
  documentsContent,
}: ProjectTabsProps) {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="tasks" className="w-full">
      <TabsList className="glass-chip w-full justify-start gap-1 rounded-2xl bg-white/5 p-1">
        <TabsTrigger
          value="tasks"
          className="rounded-xl data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-200 data-[state=active]:shadow-none text-white/60"
        >
          {t.project.tasks}
        </TabsTrigger>
        <TabsTrigger
          value="milestones"
          className="rounded-xl data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-200 data-[state=active]:shadow-none text-white/60"
        >
          {t.project.milestones}
        </TabsTrigger>
        <TabsTrigger
          value="risks"
          className="rounded-xl data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-200 data-[state=active]:shadow-none text-white/60"
        >
          {t.project.risks}
        </TabsTrigger>
        <TabsTrigger
          value="documents"
          className="rounded-xl data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-200 data-[state=active]:shadow-none text-white/60"
        >
          {t.project.documents}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-4">
        {tasksContent}
      </TabsContent>
      <TabsContent value="milestones" className="mt-4">
        {milestonesContent}
      </TabsContent>
      <TabsContent value="risks" className="mt-4">
        {risksContent}
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        {documentsContent}
      </TabsContent>
    </Tabs>
  );
}
