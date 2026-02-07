"use client";

import { useI18n } from "@/lib/i18n";
import { WebhookForm } from "@/components/settings/webhook-form";
import { MemberManagement } from "@/components/settings/member-management";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-teal-500/20 text-teal-200">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">{t.settings.title}</h1>
          </div>
        </header>

        <div className="space-y-6">
          <WebhookForm />
          <MemberManagement />
        </div>
      </div>
    </main>
  );
}
