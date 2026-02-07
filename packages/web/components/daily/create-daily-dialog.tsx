"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateDaily } from "@/lib/hooks/use-daily";
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
import { Plus, X } from "lucide-react";

interface CreateDailyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    if (draft.trim()) {
      onChange([...items, draft.trim()]);
      setDraft("");
    }
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-white/70">{label}</Label>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-white/70 rounded-none bg-white/5 px-2 py-1">
              {item}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="ghost" size="icon" onClick={add} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CreateDailyDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDailyDialogProps) {
  const { t } = useI18n();
  const { createDaily, loading } = useCreateDaily();
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [projectId, setProjectId] = useState("");
  const [achievements, setAchievements] = useState<string[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDate) return;

    try {
      await createDaily({
        reportDate,
        projectId: projectId.trim() || undefined,
        achievements,
        plans,
        issues,
      });
      setReportDate(new Date().toISOString().split("T")[0]);
      setProjectId("");
      setAchievements([]);
      setPlans([]);
      setIssues([]);
      onOpenChange(false);
      onCreated();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{t.daily.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.daily.create}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/70">{t.daily.reportDate}</Label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
                className="[color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">{t.daily.projectId}</Label>
              <Input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder={t.daily.projectId}
              />
            </div>
          </div>
          <ListEditor
            label={t.daily.achievements}
            items={achievements}
            onChange={setAchievements}
            placeholder={t.daily.itemPlaceholder}
          />
          <ListEditor
            label={t.daily.plans}
            items={plans}
            onChange={setPlans}
            placeholder={t.daily.itemPlaceholder}
          />
          <ListEditor
            label={t.daily.issues}
            items={issues}
            onChange={setIssues}
            placeholder={t.daily.itemPlaceholder}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/60"
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={loading || !reportDate}>
              {loading ? t.daily.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
