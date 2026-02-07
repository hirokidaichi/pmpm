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
import { useArchiveProject } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";

interface ArchiveProjectDialogProps {
  projectId: string;
  projectName: string;
  onArchived?: () => void;
}

export function ArchiveProjectDialog({
  projectId,
  projectName,
  onArchived,
}: ArchiveProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const archiveMutation = useArchiveProject();

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(projectId);
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
          {ja.project.archive}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {ja.project.archive}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/50">
            {ja.project.archiveConfirm}
            <br />
            <span className="font-semibold text-white/70">{projectName}</span>
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
              : ja.project.archive}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
