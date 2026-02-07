"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSendMessage } from "@/lib/hooks/use-inbox";
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

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  onSent,
}: SendMessageDialogProps) {
  const { t } = useI18n();
  const { sendMessage, loading } = useSendMessage();
  const [recipientUserId, setRecipientUserId] = useState("");
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientUserId.trim() || !title.trim()) return;

    try {
      await sendMessage({
        recipientUserId: recipientUserId.trim(),
        title: title.trim(),
        bodyMd: bodyMd.trim() || undefined,
      });
      setRecipientUserId("");
      setTitle("");
      setBodyMd("");
      onOpenChange(false);
      onSent();
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{t.inbox.sendMessage}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t.inbox.sendMessage}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70">{t.inbox.recipient}</Label>
            <Input
              value={recipientUserId}
              onChange={(e) => setRecipientUserId(e.target.value)}
              placeholder={t.inbox.recipient}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.inbox.messageTitle}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.inbox.messageTitle}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">{t.inbox.messageBody}</Label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder={t.inbox.messageBody}
              rows={5}
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
            <Button type="submit" disabled={loading || !recipientUserId.trim() || !title.trim()}>
              {loading ? t.inbox.sending : t.inbox.sendMessage}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
