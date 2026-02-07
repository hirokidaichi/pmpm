"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useUpdateDocument } from "@/lib/hooks/use-documents";
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

interface EditDocumentDialogProps {
  projectId: string;
  document: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditDocumentDialog({
  projectId,
  document: doc,
  open,
  onOpenChange,
  onUpdated,
}: EditDocumentDialogProps) {
  const { t } = useI18n();
  const { updateDocument, loading } = useUpdateDocument();
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");

  useEffect(() => {
    if (doc) {
      setTitle((doc.title as string) ?? "");
      setBodyMd((doc.bodyMd as string) ?? "");
    }
  }, [doc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateDocument(projectId, doc.id as string, {
        title: title.trim(),
        bodyMd: bodyMd.trim() || undefined,
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
          <DialogTitle className="text-white">{t.document.edit}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.document.edit}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.document.docTitle}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.document.docTitle}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.document.body}</Label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder={t.document.body}
              rows={8}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40 font-mono text-sm"
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
              {loading ? t.document.updating : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
