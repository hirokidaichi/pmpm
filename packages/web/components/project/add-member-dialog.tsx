"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/form/zod-resolver";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAddProjectMember } from "@/lib/hooks/use-projects";
import { ja } from "@/lib/i18n/ja";

const MEMBER_ROLES = ["LEAD", "MEMBER", "REVIEWER", "STAKEHOLDER"] as const;

const addMemberSchema = z.object({
  userId: z.string().min(1, ja.project.userIdRequired),
  role: z.string().min(1),
  title: z.string().optional(),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

interface AddMemberDialogProps {
  projectId: string;
}

export function AddMemberDialog({ projectId }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const addMemberMutation = useAddProjectMember();

  const form = useForm<AddMemberForm>({
    resolver: zodResolver<AddMemberForm>(addMemberSchema),
    defaultValues: { userId: "", role: "MEMBER", title: "" },
  });

  const onSubmit = async (data: AddMemberForm) => {
    try {
      await addMemberMutation.mutateAsync({
        projectId,
        userId: data.userId,
        role: data.role,
        title: data.title || undefined,
      });
      form.reset({ userId: "", role: "MEMBER", title: "" });
      setOpen(false);
    } catch {
      // Error is available via addMemberMutation.error
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
          <UserPlus className="h-4 w-4" />
          {ja.project.addMember}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1a2e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {ja.project.addMember}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {ja.workspace.members}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-user-id" className="text-white/70">
              {ja.project.userId}
            </Label>
            <Input
              id="member-user-id"
              placeholder={ja.project.userId}
              {...form.register("userId")}
            />
            {form.formState.errors.userId && (
              <p className="text-xs text-red-400">
                {form.formState.errors.userId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">{ja.project.role}</Label>
            <Select
              value={form.watch("role")}
              onValueChange={(value) => form.setValue("role", value)}
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0f1a2e]">
                {MEMBER_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="text-white/80 focus:bg-white/10 focus:text-white">
                    {(ja.memberRole as Record<string, string>)[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-title" className="text-white/70">
              {ja.project.memberTitle}
            </Label>
            <Input
              id="member-title"
              placeholder={ja.project.memberTitle}
              {...form.register("title")}
            />
          </div>

          {addMemberMutation.error && (
            <p className="text-xs text-red-400">
              {addMemberMutation.error.message}
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
              disabled={addMemberMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {addMemberMutation.isPending
                ? ja.common.saving
                : ja.project.addMember}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
