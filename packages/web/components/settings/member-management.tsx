"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  useServerMembers,
  useInviteMember,
  useUpdateMember,
  useRemoveMember,
} from "@/lib/hooks/use-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Users, Plus, Trash2 } from "lucide-react";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

export function MemberManagement() {
  const { t } = useI18n();
  const { members, loading, refresh } = useServerMembers();
  const { inviteMember, loading: inviting } = useInviteMember();
  const { updateMember } = useUpdateMember();
  const { removeMember } = useRemoveMember();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await inviteMember({ email: email.trim(), role });
      setEmail("");
      setRole("MEMBER");
      setInviteOpen(false);
      refresh();
    } catch {
      // handled by hook
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateMember(userId, { role: newRole });
    refresh();
  };

  const handleRemove = async (userId: string) => {
    await removeMember(userId);
    refresh();
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-teal-300" />
            {t.server.members}
          </CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t.server.invite}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-white/40">{t.common.loading}</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-white/40">{t.common.noData}</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const userId = (member.userId ?? member.id) as string;
              const memberEmail = (member.email as string) ?? userId;
              const memberRole = (member.role as string) ?? "MEMBER";

              return (
                <div
                  key={userId}
                  className="flex items-center justify-between gap-3 rounded-none border border-white/5 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white truncate block">{memberEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={memberRole}
                      onValueChange={(v) => handleRoleChange(userId, v)}
                    >
                      <SelectTrigger className="h-7 w-28 border-white/10 bg-white/5 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-navy-900">
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-strong border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">
                            {t.common.confirm}
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-white/50">
                            {t.server.removeConfirm}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-white/60">
                            {t.common.cancel}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(userId)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t.common.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{t.server.invite}</DialogTitle>
            <DialogDescription className="text-white/50">
              {t.server.invite}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">{t.auth.email}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.email}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">{t.server.role}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-navy-900">
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInviteOpen(false)}
                className="text-white/60"
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={inviting || !email.trim()}>
                {inviting ? t.server.inviting : t.server.invite}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
