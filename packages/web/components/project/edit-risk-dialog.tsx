"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useUpdateRisk } from "@/lib/hooks/use-risks";
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
const RISK_STATUSES = ["IDENTIFIED", "MITIGATING", "MITIGATED", "OCCURRED", "ACCEPTED"] as const;

interface EditRiskDialogProps {
  risk: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditRiskDialog({
  risk,
  open,
  onOpenChange,
  onUpdated,
}: EditRiskDialogProps) {
  const { t } = useI18n();
  const { updateRisk, loading } = useUpdateRisk();
  const [title, setTitle] = useState("");
  const [probability, setProbability] = useState("MEDIUM");
  const [impact, setImpact] = useState("MEDIUM");
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [status, setStatus] = useState("IDENTIFIED");

  useEffect(() => {
    if (risk) {
      setTitle((risk.title as string) ?? "");
      setProbability((risk.probability as string) ?? "MEDIUM");
      setImpact((risk.impact as string) ?? "MEDIUM");
      setMitigationPlan((risk.mitigationPlan as string) ?? "");
      setStatus((risk.status as string) ?? "IDENTIFIED");
    }
  }, [risk]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateRisk(risk.id as string, {
        title: title.trim(),
        probability,
        impact,
        mitigationPlan: mitigationPlan.trim() || undefined,
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
          <DialogTitle className="text-white">{t.risk.edit}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.risk.edit}
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
            <Label className="text-white/70">{t.risk.status}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-navy-900">
                {RISK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {(t.riskStatus as Record<string, string>)[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {loading ? t.risk.updating : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
