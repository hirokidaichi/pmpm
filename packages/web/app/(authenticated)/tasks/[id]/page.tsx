import { notFound } from "next/navigation";
import { ja } from "@/lib/i18n/ja";
import {
  getTask,
  getComments,
  getTimeEntries,
  getTaskDependencies,
  getCurrentUser,
} from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { TaskDetailClient } from "@/components/task/task-detail-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;

  let task;
  try {
    task = await getTask(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 500)) notFound();
    throw e;
  }

  const [commentsRes, timeEntriesRes, dependencies, currentUser] =
    await Promise.all([
      getComments(id).catch(() => ({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      })),
      getTimeEntries({ taskId: id }).catch(() => ({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      })),
      getTaskDependencies(id).catch(() => ({
        predecessors: [],
        successors: [],
      })),
      getCurrentUser().catch(() => null),
    ]);

  const comments = commentsRes.items;
  const timeEntries = timeEntriesRes.items;
  const currentUserId = currentUser
    ? ((currentUser as Record<string, unknown>).id as string | undefined)
    : undefined;

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

        <TaskDetailClient
          task={task}
          comments={comments}
          timeEntries={timeEntries}
          dependencies={dependencies}
          currentUserId={currentUserId}
        />
      </div>
    </main>
  );
}
