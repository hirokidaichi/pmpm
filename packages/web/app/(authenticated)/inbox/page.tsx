export const dynamic = "force-dynamic";

import { ja } from "@/lib/i18n/ja";
import { getInbox } from "@/lib/api/endpoints";
import { formatRelativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail } from "lucide-react";

const typeBadgeColors: Record<string, string> = {
  MENTION: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  ASSIGNMENT: "bg-teal-500/20 text-teal-300 border-teal-400/30",
  STATUS_CHANGE: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  COMMENT: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  REMINDER: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  DIRECT_MESSAGE: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  SYSTEM: "bg-white/10 text-white/60 border-white/10",
};

export default async function InboxPage() {
  const data = await getInbox({ limit: 50 });
  const messages = data.items;

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">{ja.inbox.title}</h1>
            <p className="text-sm text-white/50">
              {ja.common.total}: {data.total}
            </p>
          </div>
        </header>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Mail className="mb-4 h-12 w-12 text-white/20" />
              <p className="text-sm text-white/40">{ja.inbox.noMessages}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isUnread = !(msg.readAt);
              const msgType = (msg.messageType as string) ?? "SYSTEM";
              const typeLabel =
                ja.inbox.types[msgType as keyof typeof ja.inbox.types] ?? msgType;

              return (
                <Card
                  key={msg.id as string}
                  className={isUnread ? "border-teal-400/20" : ""}
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
    </main>
  );
}
