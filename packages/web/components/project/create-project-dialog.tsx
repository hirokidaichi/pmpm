"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/form/zod-resolver";
import { Plus } from "lucide-react";
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
import { useCreateProject } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";

const createProjectSchema = z.object({
  name: z.string().min(1, ja.project.nameRequired),
  key: z
    .string()
    .min(1, ja.project.keyRequired)
    .regex(/^[A-Z][A-Z0-9_]*$/, ja.project.keyPattern),
  description: z.string().optional(),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

function toProjectKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 10);
}

interface CreateProjectDialogProps {
  workspaceId: string;
}

export function CreateProjectDialog({
  workspaceId,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateProject();

  const form = useForm<CreateProjectForm>({
    resolver: zodResolver<CreateProjectForm>(createProjectSchema),
    defaultValues: { name: "", key: "", description: "" },
  });

  const onNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate key if user hasn't manually edited it
    const currentKey = form.getValues("key");
    const expectedKey = toProjectKey(form.getValues("name"));
    if (!currentKey || currentKey === expectedKey || currentKey === toProjectKey(value.slice(0, -1))) {
      form.setValue("key", toProjectKey(value), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: CreateProjectForm) => {
    try {
      await createMutation.mutateAsync({
        workspaceId,
        name: data.name,
        key: data.key,
        description: data.description || undefined,
      });
      form.reset();
      setOpen(false);
    } catch {
      // Error is available via createMutation.error
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="h-4 w-4" />
          {ja.project.create}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {ja.project.create}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {ja.project.title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-name" className="text-white/70">
              {ja.project.name}
            </Label>
            <Input
              id="proj-name"
              placeholder={ja.project.name}
              {...form.register("name", {
                onChange: (e) => onNameChange(e.target.value),
              })}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-400">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="proj-key" className="text-white/70">
              {ja.project.key}
            </Label>
            <Input
              id="proj-key"
              placeholder="PROJ"
              className="font-mono uppercase"
              {...form.register("key")}
            />
            {form.formState.errors.key && (
              <p className="text-xs text-red-400">
                {form.formState.errors.key.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="proj-desc" className="text-white/70">
              {ja.project.description}
            </Label>
            <Textarea
              id="proj-desc"
              placeholder={ja.project.description}
              rows={3}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-teal-400/70"
              {...form.register("description")}
            />
          </div>

          {createMutation.error && (
            <p className="text-xs text-red-400">
              {createMutation.error.message}
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
              disabled={createMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {createMutation.isPending
                ? ja.project.creating
                : ja.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
