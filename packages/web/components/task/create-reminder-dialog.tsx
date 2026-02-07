"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateReminder } from "@/lib/hooks/use-reminders";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REPEAT_TYPES = ["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const;

interface CreateReminderDialogProps {
  taskId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateReminderDialog({
  taskId,
  open,
  onOpenChange,
  onCreated,
}: CreateReminderDialogProps) {
  const { t } = useI18n();
  const { createReminder, loading } = useCreateReminder();
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [repeatType, setRepeatType] = useState("NONE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) return;

    try {
      await createReminder({
        title: title.trim(),
        remindAt: new Date(remindAt).getTime(),
        repeatType: repeatType !== "NONE" ? repeatType : undefined,
        taskId,
      });
      setTitle("");
      setRemindAt("");
      setRepeatType("NONE");
      onOpenChange(false);
      onCreated();
    } catch {
      // error handled by hook
    }
  };

  const repeatLabels: Record<string, string> = {
    NONE: t.reminder.NONE,
    DAILY: t.reminder.DAILY,
    WEEKLY: t.reminder.WEEKLY,
    MONTHLY: t.reminder.MONTHLY,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{t.reminder.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.reminder.create}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.reminder.reminderTitle}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.reminder.reminderTitle}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.reminder.remindAt}</Label>
            <Input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              required
              className="[color-scheme:dark]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.reminder.repeatType}</Label>
            <Select value={repeatType} onValueChange={setRepeatType}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-navy-900">
                {REPEAT_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {repeatLabels[rt] ?? rt}
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
            <Button type="submit" disabled={loading || !title.trim() || !remindAt}>
              {loading ? t.reminder.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
