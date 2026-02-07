"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateDocument } from "@/lib/hooks/use-documents";
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

interface CreateDocumentDialogProps {
  projectId: string;
  parentDocumentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateDocumentDialog({
  projectId,
  parentDocumentId,
  open,
  onOpenChange,
  onCreated,
}: CreateDocumentDialogProps) {
  const { t } = useI18n();
  const { createDocument, loading } = useCreateDocument();
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createDocument(projectId, {
        title: title.trim(),
        contentType: "MARKDOWN",
        bodyMd: bodyMd.trim() || undefined,
        parentDocumentId,
      });
      setTitle("");
      setBodyMd("");
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
          <DialogTitle className="text-white">{t.document.create}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.document.create}
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
              {loading ? t.document.creating : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
