"use client";

import { TaskHeader } from "@/components/task/task-header";
import { CommentList } from "@/components/task/comment-list";
import { TimeEntries } from "@/components/task/time-entries";
import { DependencyList } from "@/components/task/dependency-list";
import { TaskSidebar } from "@/components/task/task-sidebar";

interface TaskDetailClientProps {
  task: Record<string, unknown>;
  comments: Record<string, unknown>[];
  timeEntries: Record<string, unknown>[];
  dependencies: {
    predecessors: Record<string, unknown>[];
    successors: Record<string, unknown>[];
  };
  currentUserId?: string;
}

export function TaskDetailClient({
  task,
  comments,
  timeEntries,
  dependencies,
  currentUserId,
}: TaskDetailClientProps) {
  const taskId = task.id as string;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main content */}
      <div className="flex flex-col gap-6">
        <div className="glass-strong rounded-none p-6">
          <TaskHeader task={task} />
        </div>
        <CommentList
          comments={comments}
          taskId={taskId}
          currentUserId={currentUserId}
        />
        <TimeEntries entries={timeEntries} />
        <DependencyList
          predecessors={dependencies.predecessors}
          successors={dependencies.successors}
          taskId={taskId}
        />
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-6">
        <TaskSidebar task={task} />
      </div>
    </div>
  );
}
