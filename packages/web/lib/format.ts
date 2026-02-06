export function formatDate(unixMs: number | undefined | null): string {
  if (!unixMs) return "—";
  return new Date(unixMs).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(unixMs: number | undefined | null): string {
  if (!unixMs) return "—";
  return new Date(unixMs).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(unixMs: number): string {
  const diff = Date.now() - unixMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(unixMs);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const importanceColors: Record<string, string> = {
  LOW: "text-white/50",
  NORMAL: "text-white/70",
  HIGH: "text-amber-400",
  CRITICAL: "text-red-400",
};

export function importanceColor(level: string): string {
  return importanceColors[level] ?? "text-white/50";
}

const importanceBadgeColors: Record<string, string> = {
  LOW: "bg-white/10 text-white/60",
  NORMAL: "bg-teal-500/20 text-teal-300",
  HIGH: "bg-amber-500/20 text-amber-300",
  CRITICAL: "bg-red-500/20 text-red-300",
};

export function importanceBadgeColor(level: string): string {
  return importanceBadgeColors[level] ?? "bg-white/10 text-white/60";
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-teal-500/20 text-teal-300",
  ON_HOLD: "bg-amber-500/20 text-amber-300",
  COMPLETED: "bg-emerald-500/20 text-emerald-300",
  CANCELLED: "bg-red-500/20 text-red-300",
};

export function statusBadgeColor(status: string): string {
  return statusColors[status] ?? "bg-white/10 text-white/60";
}

const riskProbColors: Record<string, string> = {
  LOW: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HIGH: "text-red-400",
};

export function riskProbabilityColor(prob: string): string {
  return riskProbColors[prob] ?? "text-white/50";
}

const riskImpactColors: Record<string, string> = {
  LOW: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HIGH: "text-red-400",
  CRITICAL: "text-red-500",
};

export function riskImpactColor(impact: string): string {
  return riskImpactColors[impact] ?? "text-white/50";
}

const milestoneStatusColors: Record<string, string> = {
  OPEN: "bg-teal-500/20 text-teal-300",
  COMPLETED: "bg-emerald-500/20 text-emerald-300",
  MISSED: "bg-red-500/20 text-red-300",
};

export function milestoneStatusColor(status: string): string {
  return milestoneStatusColors[status] ?? "bg-white/10 text-white/60";
}
