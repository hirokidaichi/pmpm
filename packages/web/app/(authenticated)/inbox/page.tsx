"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useInbox, useMarkRead, useMarkAllRead } from "@/lib/hooks/use-inbox";
import { formatRelativeTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Mail, Send, CheckCheck } from "lucide-react";
import { SendMessageDialog } from "@/components/inbox/send-message-dialog";

const typeBadgeColors: Record<string, string> = {
  MENTION: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  ASSIGNMENT: "bg-teal-500/20 text-teal-300 border-teal-400/30",
  STATUS_CHANGE: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  COMMENT: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  REMINDER: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  DIRECT_MESSAGE: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  SYSTEM: "bg-white/10 text-white/60 border-white/10",
};

export default function InboxPage() {
  const { t } = useI18n();
  const { messages, total, loading, refresh } = useInbox({ limit: 50 });
  const { markRead } = useMarkRead();
  const { markAllRead, loading: markingAll } = useMarkAllRead();
  const [sendOpen, setSendOpen] = useState(false);

  const handleMarkAllRead = async () => {
    await markAllRead();
    refresh();
  };

  const handleClickMessage = async (msg: Record<string, unknown>) => {
    if (!msg.readAt) {
      await markRead(msg.id as string);
      refresh();
    }
  };

  if (loading) {
    return (
      <main className="px-6 pb-20 pt-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center py-20">
          <p className="text-white/40">{t.common.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl text-white">{t.inbox.title}</h1>
            <p className="text-sm text-white/50">
              {t.common.total}: {total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="border-white/10 text-white/60 hover:bg-white/5"
            >
              <CheckCheck className="mr-1 h-4 w-4" />
              {t.inbox.markAllRead}
            </Button>
            <Button size="sm" onClick={() => setSendOpen(true)}>
              <Send className="mr-1 h-4 w-4" />
              {t.inbox.sendMessage}
            </Button>
          </div>
        </header>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Mail className="mb-4 h-12 w-12 text-white/20" />
              <p className="text-sm text-white/40">{t.inbox.noMessages}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isUnread = !(msg.readAt);
              const msgType = (msg.messageType as string) ?? "SYSTEM";
              const typeLabel =
                t.inbox.types[msgType as keyof typeof t.inbox.types] ?? msgType;

              return (
                <Card
                  key={msg.id as string}
                  className={`cursor-pointer transition-colors hover:bg-white/5 ${isUnread ? "border-teal-400/20" : ""}`}
                  onClick={() => handleClickMessage(msg)}
                >
                  <CardContent className="flex items-start gap-4 px-6 py-4">
                    {isUnread && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-none bg-teal-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold ${typeBadgeColors[msgType] ?? typeBadgeColors.SYSTEM}`}
                        >
                          {typeLabel}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {(msg.title as string) ?? ""}
                        </span>
                      </div>
                      {typeof msg.body === "string" && msg.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-white/50">
                          {msg.body}
                        </p>
                      )}
                    </div>
                    {typeof msg.createdAt === "number" && (
                      <span className="shrink-0 text-xs text-white/40">
                        {formatRelativeTime(msg.createdAt)}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <SendMessageDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={refresh}
      />
    </main>
  );
}
