import { ja } from "@/lib/i18n/ja";
import { formatRelativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, User } from "lucide-react";

interface CommentListProps {
  comments: Record<string, unknown>[];
}

export function CommentList({ comments }: CommentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-teal-300" />
          {ja.task.comments}
          <span className="text-sm font-normal text-white/50">({comments.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <p className="text-sm text-white/40">{ja.task.noComments}</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment, index) => (
              <div key={(comment.id as string) ?? index}>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-white/10">
                    <User className="h-4 w-4 text-white/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">
                        {(comment.authorName as string) ?? (comment.userId as string) ?? "Unknown"}
                      </span>
                      {typeof comment.createdAt === "number" && (
                        <span className="text-xs text-white/40">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      {(comment.bodyMd as string) ?? (comment.body as string) ?? ""}
                    </p>
                  </div>
                </div>
                {index < comments.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
