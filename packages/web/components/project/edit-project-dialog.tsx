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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateProject } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";

const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

const editProjectSchema = z.object({
  name: z.string().min(1, ja.project.nameRequired),
  description: z.string().optional(),
  status: z.string().optional(),
});

type EditProjectForm = z.infer<typeof editProjectSchema>;

interface EditProjectDialogProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    status?: string | null;
  };
}

export function EditProjectDialog({ project }: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateProject();

  const form = useForm<EditProjectForm>({
    resolver: zodResolver<EditProjectForm>(editProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      status: project.status ?? "ACTIVE",
    },
  });

  // Reset form when project data changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name,
        description: project.description ?? "",
        status: project.status ?? "ACTIVE",
      });
    }
  }, [open, project.name, project.description, project.status, form]);

  const onSubmit = async (data: EditProjectForm) => {
    try {
      await updateMutation.mutateAsync({
        id: project.id,
        name: data.name,
        description: data.description || undefined,
        status: data.status || undefined,
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
          {ja.project.edit}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {ja.project.edit}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {project.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-proj-name" className="text-white/70">
              {ja.project.name}
            </Label>
            <Input
              id="edit-proj-name"
              placeholder={ja.project.name}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-400">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-proj-desc" className="text-white/70">
              {ja.project.description}
            </Label>
            <Textarea
              id="edit-proj-desc"
              placeholder={ja.project.description}
              rows={3}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-teal-400/70"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">{ja.project.status}</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(value) => form.setValue("status", value)}
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0f1a2e]">
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-white/80 focus:bg-white/10 focus:text-white">
                    {(ja.status as Record<string, string>)[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                ? ja.project.updating
                : ja.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
