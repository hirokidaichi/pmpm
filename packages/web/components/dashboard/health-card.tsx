"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

interface HealthCardProps {
  health: {
    status: string;
    timestamp: number;
    version: string;
  } | null;
}

export function HealthCard({ health }: HealthCardProps) {
  const { t } = useI18n();
  const isOnline = health?.status === "ok";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t.dashboard.serverStatus}</CardTitle>
          <Badge variant={isOnline ? "success" : "navy"} className="glass-chip">
            {isOnline ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {isOnline ? t.dashboard.online : t.dashboard.offline}
          </Badge>
        </div>
        <CardDescription>
          {health
            ? `v${health.version}`
            : t.dashboard.offline}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">{t.dashboard.apiLatency}</span>
          <span className="text-sm font-semibold text-white">
            {health ? `${Date.now() - health.timestamp} ms` : "\u2014"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">{t.dashboard.webhooks}</span>
          <span className="text-sm font-semibold text-white">
            {isOnline ? "OK" : "\u2014"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
