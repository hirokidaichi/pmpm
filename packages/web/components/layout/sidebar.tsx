"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  BarChart3,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useInboxCount } from "@/hooks/use-inbox-count";
import { useState } from "react";

const navItems = [
  { href: "/", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/workspaces", icon: FolderKanban, labelKey: "workspaces" as const },
  { href: "/inbox", icon: Inbox, labelKey: "inbox" as const },
  { href: "/reports", icon: BarChart3, labelKey: "reports" as const },
  { href: "/daily", icon: FileText, labelKey: "daily" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const inboxCount = useInboxCount();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : (pathname ?? "").startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        const label = t.nav[item.labelKey];

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-teal-500/15 text-teal-300"
                : "text-white/60 hover:bg-white/5 hover:text-white/90"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {item.labelKey === "inbox" && inboxCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-none bg-teal-500 px-1.5 text-[10px] font-bold text-navy-950">
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-none p-2 text-white/70 hover:bg-white/10 lg:hidden"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col glass-strong border-r border-white/10 transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="font-display text-lg font-bold tracking-tight text-teal-400 text-shadow-glow">
            pmpm
          </span>
          <span className="text-xs text-white/40">console</span>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>

        <div className="h-px w-full bg-white/10" />
        <div className="px-5 py-3">
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            v0.1.0
          </span>
        </div>
      </aside>
    </>
  );
}
