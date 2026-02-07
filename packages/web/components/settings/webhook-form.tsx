"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
} from "@/lib/hooks/use-webhooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Webhook, Plus, Pencil, Trash2, Zap } from "lucide-react";

const WEBHOOK_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "comment.created",
  "milestone.completed",
  "risk.created",
];

export function WebhookForm() {
  const { t } = useI18n();
  const { webhooks, loading, refresh } = useWebhooks();
  const { createWebhook, loading: creating } = useCreateWebhook();
  const { updateWebhook, loading: updating } = useUpdateWebhook();
  const { deleteWebhook } = useDeleteWebhook();
  const { testWebhook, loading: testing, success: testSuccess } = useTestWebhook();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setUrl("");
    setEvents([]);
    setSecret("");
    setDialogOpen(true);
  };

  const openEdit = (wh: Record<string, unknown>) => {
    setEditingId(wh.id as string);
    setUrl((wh.url as string) ?? "");
    setEvents((wh.events as string[]) ?? []);
    setSecret("");
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      if (editingId) {
        await updateWebhook(editingId, {
          url: url.trim(),
          events,
          secret: secret.trim() || undefined,
        });
      } else {
        await createWebhook({
          url: url.trim(),
          events,
          secret: secret.trim() || undefined,
        });
      }
      setDialogOpen(false);
      refresh();
    } catch {
      // handled by hook
    }
  };

  const handleDelete = async (id: string) => {
    await deleteWebhook(id);
    refresh();
  };

  const handleTest = async (id: string) => {
    await testWebhook(id);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Webhook className="h-5 w-5 text-teal-300" />
            {t.webhook.title}
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {t.webhook.create}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-white/40">{t.common.loading}</p>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-white/40">{t.common.noData}</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => {
              const id = wh.id as string;
              const whUrl = wh.url as string;
              const whEvents = (wh.events as string[]) ?? [];
              const active = wh.active !== false;

              return (
                <div
                  key={id}
                  className="flex items-start justify-between gap-4 rounded-none border border-white/5 bg-white/5 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {whUrl}
                      </span>
                      <Badge
                        className={
                          active
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                            : "bg-white/10 text-white/40 border-white/10"
                        }
                      >
                        {active ? t.webhook.active : t.webhook.inactive}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {whEvents.map((ev) => (
                        <span
                          key={ev}
                          className="inline-block rounded-none bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-teal-400 hover:bg-teal-500/20"
                      onClick={() => handleTest(id)}
                      disabled={testing}
                      title={t.webhook.test}
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/50 hover:bg-white/10"
                      onClick={() => openEdit(wh)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-strong border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">
                            {t.common.confirm}
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-white/50">
                            {t.webhook.deleteConfirm}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-white/60">
                            {t.common.cancel}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t.common.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {testSuccess && (
          <p className="mt-2 text-xs text-emerald-400">{t.webhook.testSuccess}</p>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? t.webhook.edit : t.webhook.create}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editingId ? t.webhook.edit : t.webhook.create}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">{t.webhook.url}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">{t.webhook.events}</Label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`rounded-none border px-2 py-1 text-xs transition ${
                      events.includes(ev)
                        ? "border-teal-400/30 bg-teal-500/20 text-teal-200"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">{t.webhook.secret}</Label>
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={t.webhook.secret}
                type="password"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-white/60"
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={creating || updating || !url.trim()}>
                {creating || updating
                  ? editingId
                    ? t.webhook.updating
                    : t.webhook.creating
                  : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
