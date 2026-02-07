"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTask } from "@/lib/hooks/use-tasks";
import { ja } from "@/lib/i18n/ja";

interface CreateTaskDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({ projectId, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState("NORMAL");
  const [parentTaskId, setParentTaskId] = useState("");
  const [assigneesInput, setAssigneesInput] = useState("");

  const createTask = useCreateTask();

  function resetForm() {
    setTitle("");
    setDescription("");
    setImportance("NORMAL");
    setParentTaskId("");
    setAssigneesInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const assignees = assigneesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((userId) => ({ userId }));

    await createTask.mutateAsync({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      importance,
      parentTaskId: parentTaskId.trim() || undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
    });

    resetForm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="gap-1.5 rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
          >
            <Plus className="h-4 w-4" />
            {ja.task.title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 bg-[#0f1629] sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white">
              {ja.task.title}を作成
            </DialogTitle>
            <DialogDescription className="text-white/50">
              プロジェクトに新しいタスクを追加します
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title" className="text-white/70">
                {ja.task.title} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="タスク名を入力"
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-description" className="text-white/70">
                {ja.task.description}
              </Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="タスクの説明を入力"
                rows={3}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30 rounded-none"
              />
            </div>

            {/* Importance */}
            <div className="space-y-2">
              <Label className="text-white/70">{ja.task.importance}</Label>
              <Select value={importance} onValueChange={setImportance}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f1629]">
                  <SelectItem value="LOW">{ja.importance.LOW}</SelectItem>
                  <SelectItem value="NORMAL">{ja.importance.NORMAL}</SelectItem>
                  <SelectItem value="HIGH">{ja.importance.HIGH}</SelectItem>
                  <SelectItem value="CRITICAL">{ja.importance.CRITICAL}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parent Task ID */}
            <div className="space-y-2">
              <Label htmlFor="task-parent" className="text-white/70">
                親タスクID
              </Label>
              <Input
                id="task-parent"
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
                placeholder="親タスクのIDを入力（任意）"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Assignees */}
            <div className="space-y-2">
              <Label htmlFor="task-assignees" className="text-white/70">
                {ja.task.assignees}
              </Label>
              <Input
                id="task-assignees"
                value={assigneesInput}
                onChange={(e) => setAssigneesInput(e.target.value)}
                placeholder="ユーザーIDをカンマ区切りで入力"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <p className="text-xs text-white/40">
                複数の担当者はカンマで区切ってください
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createTask.isPending}
              className="rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
            >
              {createTask.isPending ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
