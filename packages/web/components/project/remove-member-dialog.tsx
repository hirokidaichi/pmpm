"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useRemoveProjectMember } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";

interface RemoveMemberDialogProps {
  projectId: string;
  userId: string;
}

export function RemoveMemberDialog({
  projectId,
  userId,
}: RemoveMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const removeMutation = useRemoveProjectMember();

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync({ projectId, userId });
      setOpen(false);
    } catch {
      // Error is available via removeMutation.error
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {ja.project.removeMember}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/50">
            {ja.project.removeMemberConfirm}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10 bg-transparent text-white/60 hover:text-white hover:bg-white/10">
            {ja.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {removeMutation.isPending
              ? ja.common.saving
              : ja.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
