"use client";

import { useState } from "react";
import { ja } from "@/lib/i18n/ja";
import { formatRelativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, User, Pencil, Trash2, X, Check } from "lucide-react";
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
import { useUpdateComment, useDeleteComment } from "@/lib/hooks/use-comments";
import { CommentForm } from "./comment-form";

interface CommentListProps {
  comments: Record<string, unknown>[];
  taskId: string;
  currentUserId?: string;
}

function CommentItem({
  comment,
  taskId,
  currentUserId,
  isLast,
}: {
  comment: Record<string, unknown>;
  taskId: string;
  currentUserId?: string;
  isLast: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const commentId = comment.id as string;
  const commentUserId = comment.userId as string;
  const isOwner = currentUserId && commentUserId === currentUserId;

  function startEdit() {
    setEditBody(
      (comment.bodyMd as string) ?? (comment.body as string) ?? "",
    );
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    if (!editBody.trim()) return;
    await updateComment.mutateAsync({
      taskId,
      commentId,
      body: editBody.trim(),
    });
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteComment.mutateAsync({ taskId, commentId });
  }

  return (
    <div key={commentId}>
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-white/10">
          <User className="h-4 w-4 text-white/50" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">
              {(comment.authorName as string) ??
                (comment.userId as string) ??
                "Unknown"}
            </span>
            {typeof comment.createdAt === "number" && (
              <span className="text-xs text-white/40">
                {formatRelativeTime(comment.createdAt)}
              </span>
            )}

            {/* Edit/Delete buttons - shown for own comments */}
            {isOwner && !isEditing && (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startEdit}
                  className="h-6 w-6 p-0 text-white/30 hover:text-white/70 hover:bg-white/10"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-[#0f1629]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">
                        コメントを削除
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-white/50">
                        このコメントを削除しますか？この操作は元に戻せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                        キャンセル
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30 rounded-none resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editBody.trim() || updateComment.isPending}
                  className="h-7 gap-1 rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
                >
                  <Check className="h-3 w-3" />
                  {updateComment.isPending ? "保存中..." : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="h-7 gap-1 text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              {(comment.bodyMd as string) ?? (comment.body as string) ?? ""}
            </p>
          )}
        </div>
      </div>
      {!isLast && <Separator className="mt-4" />}
    </div>
  );
}

export function CommentList({ comments, taskId, currentUserId }: CommentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-teal-300" />
          {ja.task.comments}
          <span className="text-sm font-normal text-white/50">
            ({comments.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <p className="text-sm text-white/40">{ja.task.noComments}</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment, index) => (
              <CommentItem
                key={(comment.id as string) ?? index}
                comment={comment}
                taskId={taskId}
                currentUserId={currentUserId}
                isLast={index === comments.length - 1}
              />
            ))}
          </div>
        )}

        {/* Comment form */}
        <CommentForm taskId={taskId} />
      </CardContent>
    </Card>
  );
}
