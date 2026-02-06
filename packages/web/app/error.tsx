"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="font-display text-lg font-bold text-white/90">
          {t.common.error}
        </h2>
        <p className="text-sm text-white/50">
          {error.message || t.common.error}
        </p>
        <Button variant="outline" onClick={reset}>
          {t.common.retry}
        </Button>
      </div>
    </div>
  );
}
