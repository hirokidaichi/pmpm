"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { useCreateDependency } from "@/lib/hooks/use-dependencies";

interface AddDependencyDialogProps {
  taskId: string;
  trigger?: React.ReactNode;
}

type Direction = "predecessor" | "successor";

export function AddDependencyDialog({
  taskId,
  trigger,
}: AddDependencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("predecessor");
  const [targetTaskId, setTargetTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState("FS");

  const createDependency = useCreateDependency();

  function resetForm() {
    setDirection("predecessor");
    setTargetTaskId("");
    setDependencyType("FS");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetTaskId.trim()) return;

    const data =
      direction === "predecessor"
        ? {
            predecessorTaskId: targetTaskId.trim(),
            successorTaskId: taskId,
            dependencyType,
          }
        : {
            predecessorTaskId: taskId,
            successorTaskId: targetTaskId.trim(),
            dependencyType,
          };

    await createDependency.mutateAsync(data);

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
            className="gap-1 text-teal-300 hover:text-teal-200 hover:bg-teal-500/10"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 bg-[#0f1629] sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white">依存関係を追加</DialogTitle>
            <DialogDescription className="text-white/50">
              タスク間の依存関係を定義します
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {/* Direction */}
            <div className="space-y-2">
              <Label className="text-white/70">種別</Label>
              <Select
                value={direction}
                onValueChange={(val) => setDirection(val as Direction)}
              >
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f1629]">
                  <SelectItem value="predecessor">前提タスク</SelectItem>
                  <SelectItem value="successor">後続タスク</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Task ID */}
            <div className="space-y-2">
              <Label htmlFor="dep-target-task" className="text-white/70">
                タスクID <span className="text-red-400">*</span>
              </Label>
              <Input
                id="dep-target-task"
                value={targetTaskId}
                onChange={(e) => setTargetTaskId(e.target.value)}
                placeholder="対象タスクのIDを入力"
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Dependency Type */}
            <div className="space-y-2">
              <Label className="text-white/70">依存タイプ</Label>
              <Select value={dependencyType} onValueChange={setDependencyType}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f1629]">
                  <SelectItem value="FS">
                    FS (Finish-to-Start)
                  </SelectItem>
                  <SelectItem value="SS">
                    SS (Start-to-Start)
                  </SelectItem>
                  <SelectItem value="FF">
                    FF (Finish-to-Finish)
                  </SelectItem>
                  <SelectItem value="SF">
                    SF (Start-to-Finish)
                  </SelectItem>
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
              disabled={!targetTaskId.trim() || createDependency.isPending}
              className="rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
            >
              {createDependency.isPending ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
