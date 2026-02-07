"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useUpdateMilestone } from "@/lib/hooks/use-milestones";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MILESTONE_STATUSES = ["OPEN", "COMPLETED", "MISSED"] as const;

interface EditMilestoneDialogProps {
  milestone: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditMilestoneDialog({
  milestone,
  open,
  onOpenChange,
  onUpdated,
}: EditMilestoneDialogProps) {
  const { t } = useI18n();
  const { updateMilestone, loading } = useUpdateMilestone();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState("OPEN");

  useEffect(() => {
    if (milestone) {
      setName((milestone.name as string) ?? "");
      setDescription((milestone.description as string) ?? "");
      setStatus((milestone.status as string) ?? "OPEN");
      const dueMs = milestone.dueAt as number | undefined;
      if (dueMs) {
        const d = new Date(dueMs);
        setDueAt(d.toISOString().split("T")[0]);
      } else {
        setDueAt("");
      }
    }
  }, [milestone]);

  const statusLabels: Record<string, string> = {
    OPEN: t.milestone.open,
    COMPLETED: t.milestone.completed,
    MISSED: t.milestone.missed,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await updateMilestone(milestone.id as string, {
        name: name.trim(),
        description: description.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).getTime() : undefined,
        status,
      });
      onOpenChange(false);
      onUpdated();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{t.milestone.edit}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.milestone.edit}
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
          <div className="space-y-2">
            <Label className="text-white/70">{t.milestone.status}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-navy-900">
                {MILESTONE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {loading ? t.milestone.updating : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
