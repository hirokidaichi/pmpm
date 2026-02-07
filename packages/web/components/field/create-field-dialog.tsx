"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateField } from "@/lib/hooks/use-fields";
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

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "MULTI_SELECT", "CHECKBOX"] as const;
const TYPES_WITH_OPTIONS = ["DROPDOWN", "MULTI_SELECT"];

interface CreateFieldDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateFieldDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateFieldDialogProps) {
  const { t } = useI18n();
  const { createField, loading } = useCreateField();
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [optionsStr, setOptionsStr] = useState("");

  const showOptions = TYPES_WITH_OPTIONS.includes(fieldType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const options = showOptions
        ? optionsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      await createField({
        projectId,
        name: name.trim(),
        fieldType,
        options,
      });
      setName("");
      setFieldType("TEXT");
      setOptionsStr("");
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
          <DialogTitle className="text-white">{t.field.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.field.create}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.field.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.field.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.field.fieldType}</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-navy-900">
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {(t.field as Record<string, string>)[ft] ?? ft}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showOptions && (
            <div className="space-y-2">
              <Label className="text-white/70">{t.field.options}</Label>
              <Input
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                placeholder={t.field.optionsHint}
              />
              <p className="text-xs text-white/40">{t.field.optionsHint}</p>
            </div>
          )}
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
              {loading ? t.field.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
