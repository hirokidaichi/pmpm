"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
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
import { useArchiveWorkspace } from "@/lib/hooks/use-workspaces";
import { ja } from "@/lib/i18n/ja";

interface ArchiveWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
  onArchived?: () => void;
}

export function ArchiveWorkspaceDialog({
  workspaceId,
  workspaceName,
  onArchived,
}: ArchiveWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const archiveMutation = useArchiveWorkspace();

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(workspaceId);
      setOpen(false);
      onArchived?.();
    } catch {
      // Error is available via archiveMutation.error
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
        >
          <Archive className="h-4 w-4" />
          {ja.workspace.archive}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {ja.workspace.archive}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/50">
            {ja.workspace.archiveConfirm}
            <br />
            <span className="font-semibold text-white/70">{workspaceName}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10 bg-transparent text-white/60 hover:text-white hover:bg-white/10">
            {ja.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {archiveMutation.isPending
              ? ja.common.saving
              : ja.workspace.archive}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
