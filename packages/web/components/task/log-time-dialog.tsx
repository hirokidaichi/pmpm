"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useLogTime, useTimeCategories } from "@/lib/hooks/use-time";
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

interface LogTimeDialogProps {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}

export function LogTimeDialog({
  taskId,
  open,
  onOpenChange,
  onLogged,
}: LogTimeDialogProps) {
  const { t } = useI18n();
  const { logTime, loading } = useLogTime();
  const { categories } = useTimeCategories();
  const [minutes, setMinutes] = useState("");
  const [comment, setComment] = useState("");
  const [categoryId, setCategoryId] = useState("__none__");

  useEffect(() => {
    if (open) {
      setMinutes("");
      setComment("");
      setCategoryId("__none__");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) return;

    try {
      await logTime({
        taskId,
        minutes: mins,
        comment: comment.trim() || undefined,
        categoryId: categoryId !== "__none__" ? categoryId : undefined,
      });
      onOpenChange(false);
      onLogged();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{t.time.logTime}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.time.logTime}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.time.minutes}</Label>
            <Input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="30"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.time.comment}</Label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.time.comment}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.time.category}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder={t.time.noCategory} />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-navy-900">
                <SelectItem value="__none__">{t.time.noCategory}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id as string} value={cat.id as string}>
                    {cat.name as string}
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
            <Button type="submit" disabled={loading || !minutes}>
              {loading ? t.time.logging : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
