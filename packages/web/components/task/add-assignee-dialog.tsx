"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAddAssignee } from "@/lib/hooks/use-tasks";

interface AddAssigneeDialogProps {
  taskId: string;
  trigger?: React.ReactNode;
}

export function AddAssigneeDialog({ taskId, trigger }: AddAssigneeDialogProps) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("ASSIGNEE");

  const addAssignee = useAddAssignee();

  function resetForm() {
    setUserId("");
    setRole("ASSIGNEE");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;

    await addAssignee.mutateAsync({
      taskId,
      userId: userId.trim(),
      role,
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
            variant="ghost"
            className="gap-1.5 text-teal-300 hover:text-teal-200 hover:bg-teal-500/10"
          >
            <UserPlus className="h-3.5 w-3.5" />
            追加
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 bg-[#0f1629] sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white">担当者を追加</DialogTitle>
            <DialogDescription className="text-white/50">
              タスクに担当者を割り当てます
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {/* User ID */}
            <div className="space-y-2">
              <Label htmlFor="assignee-user-id" className="text-white/70">
                ユーザーID <span className="text-red-400">*</span>
              </Label>
              <Input
                id="assignee-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="ユーザーIDを入力"
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label className="text-white/70">ロール</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f1629]">
                  <SelectItem value="ASSIGNEE">担当者</SelectItem>
                  <SelectItem value="REVIEWER">レビュアー</SelectItem>
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
              disabled={!userId.trim() || addAssignee.isPending}
              className="rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
            >
              {addAssignee.isPending ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
