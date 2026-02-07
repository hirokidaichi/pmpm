"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateComment } from "@/lib/hooks/use-comments";

interface CommentFormProps {
  taskId: string;
}

export function CommentForm({ taskId }: CommentFormProps) {
  const [body, setBody] = useState("");
  const createComment = useCreateComment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    await createComment.mutateAsync({ taskId, body: body.trim() });
    setBody("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="space-y-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="コメントを入力..."
          rows={3}
          className="border-white/10 bg-white/5 text-white placeholder:text-white/30 rounded-none resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || createComment.isPending}
            className="gap-1.5 rounded-none bg-teal-500/20 text-teal-200 hover:bg-teal-500/30 border border-teal-500/30"
          >
            <Send className="h-3.5 w-3.5" />
            {createComment.isPending ? "送信中..." : "コメント"}
          </Button>
        </div>
      </div>
    </form>
  );
}
