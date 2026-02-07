"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useUpdateDaily } from "@/lib/hooks/use-daily";
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

interface EditDailyDialogProps {
  report: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
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

export function EditDailyDialog({
  report,
  open,
  onOpenChange,
  onUpdated,
}: EditDailyDialogProps) {
  const { t } = useI18n();
  const { updateDaily, loading } = useUpdateDaily();
  const [achievements, setAchievements] = useState<string[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (report) {
      setAchievements((report.achievements as string[]) ?? []);
      setPlans((report.plans as string[]) ?? []);
      setIssues((report.issues as string[]) ?? []);
    }
  }, [report]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateDaily(report.id as string, {
        achievements,
        plans,
        issues,
      });
      onOpenChange(false);
      onUpdated();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{t.daily.edit}</DialogTitle>
          <DialogDescription className="text-white/50">
            {(report.reportDate as string) ?? ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" disabled={loading}>
              {loading ? t.daily.updating : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
