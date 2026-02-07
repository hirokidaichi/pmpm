"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/form/zod-resolver";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateWorkspace } from "@/lib/hooks/use-workspaces";
import { ja } from "@/lib/i18n/ja";

const editWorkspaceSchema = z.object({
  name: z.string().min(1, ja.workspace.nameRequired),
  description: z.string().optional(),
});

type EditWorkspaceForm = z.infer<typeof editWorkspaceSchema>;

interface EditWorkspaceDialogProps {
  workspace: {
    id: string;
    name: string;
    description?: string | null;
  };
}

export function EditWorkspaceDialog({ workspace }: EditWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateWorkspace();

  const form = useForm<EditWorkspaceForm>({
    resolver: zodResolver<EditWorkspaceForm>(editWorkspaceSchema),
    defaultValues: {
      name: workspace.name,
      description: workspace.description ?? "",
    },
  });

  // Reset form when workspace data changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: workspace.name,
        description: workspace.description ?? "",
      });
    }
  }, [open, workspace.name, workspace.description, form]);

  const onSubmit = async (data: EditWorkspaceForm) => {
    try {
      await updateMutation.mutateAsync({
        id: workspace.id,
        name: data.name,
        description: data.description || undefined,
      });
      setOpen(false);
    } catch {
      // Error is available via updateMutation.error
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Pencil className="h-4 w-4" />
          {ja.workspace.edit}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {ja.workspace.edit}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {workspace.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-ws-name" className="text-white/70">
              {ja.workspace.name}
            </Label>
            <Input
              id="edit-ws-name"
              placeholder={ja.workspace.name}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-400">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ws-desc" className="text-white/70">
              {ja.workspace.description}
            </Label>
            <Textarea
              id="edit-ws-desc"
              placeholder={ja.workspace.description}
              rows={3}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-teal-400/70"
              {...form.register("description")}
            />
          </div>

          {updateMutation.error && (
            <p className="text-xs text-red-400">
              {updateMutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white"
            >
              {ja.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {updateMutation.isPending
                ? ja.workspace.updating
                : ja.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
