"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useFields, useSetFieldValue } from "@/lib/hooks/use-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomFieldsProps {
  projectId: string;
  taskId: string;
  fieldValues?: Record<string, string>;
}

export function CustomFields({ projectId, taskId, fieldValues = {} }: CustomFieldsProps) {
  const { t } = useI18n();
  const { fields, loading: fieldsLoading } = useFields(projectId);
  const { setFieldValue } = useSetFieldValue();
  const [localValues, setLocalValues] = useState<Record<string, string>>(fieldValues);
  const [savingField, setSavingField] = useState<string | null>(null);

  if (fieldsLoading) return null;
  if (fields.length === 0) return null;

  const handleSave = async (fieldId: string) => {
    setSavingField(fieldId);
    try {
      await setFieldValue({
        taskId,
        fieldId,
        value: localValues[fieldId] ?? "",
      });
    } finally {
      setSavingField(null);
    }
  };

  const handleChange = (fieldId: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings2 className="h-4 w-4 text-teal-300" />
          {t.field.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field) => {
          const fieldId = field.id as string;
          const fieldName = field.name as string;
          const fieldType = field.fieldType as string;
          const options = (field.options as string[]) ?? [];
          const currentValue = localValues[fieldId] ?? fieldValues[fieldId] ?? "";

          return (
            <div key={fieldId} className="space-y-1">
              <Label className="text-xs text-white/50">{fieldName}</Label>
              <div className="flex items-center gap-1">
                {fieldType === "DROPDOWN" ? (
                  <Select
                    value={currentValue}
                    onValueChange={(v) => {
                      handleChange(fieldId, v);
                    }}
                  >
                    <SelectTrigger className="h-8 border-white/10 bg-white/5 text-white text-xs">
                      <SelectValue placeholder="--" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-navy-900">
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : fieldType === "CHECKBOX" ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentValue === "true"}
                      onChange={(e) => handleChange(fieldId, String(e.target.checked))}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-teal-500"
                    />
                  </label>
                ) : fieldType === "DATE" ? (
                  <Input
                    type="date"
                    value={currentValue}
                    onChange={(e) => handleChange(fieldId, e.target.value)}
                    className="h-8 text-xs [color-scheme:dark]"
                  />
                ) : fieldType === "NUMBER" ? (
                  <Input
                    type="number"
                    value={currentValue}
                    onChange={(e) => handleChange(fieldId, e.target.value)}
                    className="h-8 text-xs"
                  />
                ) : (
                  <Input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleChange(fieldId, e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-teal-400 hover:bg-teal-500/20"
                  onClick={() => handleSave(fieldId)}
                  disabled={savingField === fieldId}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
