"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateMilestone } from "@/lib/hooks/use-milestones";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateMilestoneDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateMilestoneDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateMilestoneDialogProps) {
  const { t } = useI18n();
  const { createMilestone, loading } = useCreateMilestone();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createMilestone({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).getTime() : undefined,
      });
      setName("");
      setDescription("");
      setDueAt("");
      onOpenChange(false);
      onCreated();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{t.milestone.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.milestone.create}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.milestone.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.milestone.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.milestone.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.milestone.description}
              rows={3}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.milestone.dueAt}</Label>
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/60"
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? t.milestone.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
