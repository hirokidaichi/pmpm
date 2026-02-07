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
import { useCreateWorkspace } from "@/lib/hooks/use-workspaces";
import { ja } from "@/lib/i18n/ja";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, ja.workspace.nameRequired),
  slug: z
    .string()
    .min(1, ja.workspace.slugRequired)
    .regex(/^[a-z0-9-]+$/, ja.workspace.slugPattern),
  description: z.string().optional(),
});

type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateWorkspace();

  const form = useForm<CreateWorkspaceForm>({
    resolver: zodResolver<CreateWorkspaceForm>(createWorkspaceSchema),
    defaultValues: { name: "", slug: "", description: "" },
  });

  const onNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate slug if user hasn't manually edited it
    const currentSlug = form.getValues("slug");
    const expectedSlug = toSlug(form.getValues("name"));
    if (!currentSlug || currentSlug === expectedSlug || currentSlug === toSlug(value.slice(0, -1))) {
      form.setValue("slug", toSlug(value), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: CreateWorkspaceForm) => {
    try {
      await createMutation.mutateAsync(data);
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
          {ja.workspace.create}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {ja.workspace.create}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {ja.workspace.title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name" className="text-white/70">
              {ja.workspace.name}
            </Label>
            <Input
              id="ws-name"
              placeholder={ja.workspace.name}
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
            <Label htmlFor="ws-slug" className="text-white/70">
              {ja.workspace.slug}
            </Label>
            <Input
              id="ws-slug"
              placeholder="my-workspace"
              {...form.register("slug")}
            />
            {form.formState.errors.slug && (
              <p className="text-xs text-red-400">
                {form.formState.errors.slug.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-desc" className="text-white/70">
              {ja.workspace.description}
            </Label>
            <Textarea
              id="ws-desc"
              placeholder={ja.workspace.description}
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
                ? ja.workspace.creating
                : ja.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
