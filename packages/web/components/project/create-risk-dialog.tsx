"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateRisk } from "@/lib/hooks/use-risks";
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

const PROBABILITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface CreateRiskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateRiskDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateRiskDialogProps) {
  const { t } = useI18n();
  const { createRisk, loading } = useCreateRisk();
  const [title, setTitle] = useState("");
  const [probability, setProbability] = useState("MEDIUM");
  const [impact, setImpact] = useState("MEDIUM");
  const [mitigationPlan, setMitigationPlan] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createRisk({
        projectId,
        title: title.trim(),
        probability,
        impact,
        mitigationPlan: mitigationPlan.trim() || undefined,
      });
      setTitle("");
      setProbability("MEDIUM");
      setImpact("MEDIUM");
      setMitigationPlan("");
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
          <DialogTitle className="text-white">{t.risk.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.risk.create}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.risk.title}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.risk.title}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/70">{t.risk.probability}</Label>
              <Select value={probability} onValueChange={setProbability}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-navy-900">
                  {PROBABILITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {(t.riskProb as Record<string, string>)[p] ?? p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">{t.risk.impact}</Label>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-navy-900">
                  {IMPACTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {(t.riskImpact as Record<string, string>)[i] ?? i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.risk.mitigation}</Label>
            <Textarea
              value={mitigationPlan}
              onChange={(e) => setMitigationPlan(e.target.value)}
              placeholder={t.risk.mitigation}
              rows={3}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
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
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? t.risk.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
