"use client";

import { useEffect, useState } from "react";
import { Timer, Square } from "lucide-react";
import { useTimerStatus, useStopTimer } from "@/lib/hooks/use-time";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function TimerWidget() {
  const { t } = useI18n();
  const { timer, refresh } = useTimerStatus();
  const { stopTimer, loading: stopping } = useStopTimer();
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!timer || !timer.startedAt) {
      setElapsed("");
      return;
    }

    function calcElapsed() {
      const startedAt = timer!.startedAt as number;
      const diff = Math.floor((Date.now() - startedAt) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      );
    }

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  if (!timer || !timer.startedAt) return null;

  const handleStop = async () => {
    await stopTimer();
    refresh();
  };

  return (
    <div className="flex items-center gap-2 rounded-none border border-teal-400/30 bg-teal-500/10 px-3 py-1.5">
      <Timer className="h-4 w-4 text-teal-300 animate-pulse" />
      <span className="text-xs font-medium text-teal-200">{t.time.timerRunning}</span>
      <span className="font-mono text-sm font-bold text-teal-300">{elapsed}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-red-400 hover:bg-red-500/20 hover:text-red-300"
        onClick={handleStop}
        disabled={stopping}
        title={t.time.stopTimer}
      >
        <Square className="h-3 w-3" />
      </Button>
    </div>
  );
}
