"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
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
import { useUpdateTask } from "@/lib/hooks/use-tasks";
import { ja } from "@/lib/i18n/ja";

interface EditTaskDialogProps {
  task: Record<string, unknown>;
  trigger?: React.ReactNode;
}

export function EditTaskDialog({ task, trigger }: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState("NORMAL");

  const updateTask = useUpdateTask();

  // Populate form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle((task.title as string) ?? "");
      setDescription((task.description as string) ?? "");
      setImportance((task.importance as string) ?? "NORMAL");
    }
  }, [open, task]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = task.id as string;
    if (!id) return;

    const updates: Record<string, unknown> = { id };

    if (title.trim() && title.trim() !== (task.title as string)) {
      updates.title = title.trim();
    }
    if (description.trim() !== ((task.description as string) ?? "")) {
      updates.description = description.trim();
    }
    if (importance !== ((task.importance as string) ?? "NORMAL")) {
      updates.importance = importance;
    }

    await updateTask.mutateAsync(
      updates as Parameters<typeof updateTask.mutateAsync>[0],
    );
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            編集
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 bg-[#0f1629] sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white">
              {ja.task.title}を編集
            </DialogTitle>
            <DialogDescription className="text-white/50">
              タスクの情報を更新します
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-title" className="text-white/70">
                {ja.task.title}
              </Label>
              <Input
                id="edit-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="タスク名を入力"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-description" className="text-white/70">
                {ja.task.description}
              </Label>
              <Textarea
                id="edit-task-description"
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
              disabled={updateTask.isPending}
              className="rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
            >
              {updateTask.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
