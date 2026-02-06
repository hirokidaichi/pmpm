import { ja } from "@/lib/i18n/ja";
import { getTask, getComments, getTimeEntries, getTaskDependencies } from "@/lib/api/endpoints";
import { TaskHeader } from "@/components/task/task-header";
import { CommentList } from "@/components/task/comment-list";
import { TimeEntries } from "@/components/task/time-entries";
import { DependencyList } from "@/components/task/dependency-list";
import { TaskSidebar } from "@/components/task/task-sidebar";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;

  const [task, commentsRes, timeEntriesRes, dependencies] = await Promise.all([
    getTask(id),
    getComments(id).catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
    getTimeEntries({ taskId: id }).catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
    getTaskDependencies(id).catch(() => ({ predecessors: [], successors: [] })),
  ]);

  const comments = commentsRes.items;
  const timeEntries = timeEntriesRes.items;

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          {ja.common.back}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main content */}
          <div className="flex flex-col gap-6">
            <div className="glass-strong rounded-none p-6">
              <TaskHeader task={task} />
            </div>
            <CommentList comments={comments} />
            <TimeEntries entries={timeEntries} />
            <DependencyList
              predecessors={dependencies.predecessors}
              successors={dependencies.successors}
            />
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            <TaskSidebar task={task} />
          </div>
        </div>
      </div>
    </main>
  );
}
