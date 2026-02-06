"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Globe, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n";
import { useAuth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useBreadcrumbs() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (pathname === "/") {
    return [{ label: t.nav.dashboard }];
  }

  const segments = (pathname ?? "").split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  const navLabelMap: Record<string, string> = {
    workspaces: t.nav.workspaces,
    inbox: t.nav.inbox,
    reports: t.nav.reports,
    daily: t.nav.daily,
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = navLabelMap[seg] ?? decodeURIComponent(seg);
    const isLast = i === segments.length - 1;
    crumbs.push({ label, href: isLast ? undefined : href });
  }

  return crumbs;
}

const localeLabels: Record<Locale, string> = {
  ja: "JA",
  en: "EN",
};

export function Topbar() {
  const { locale, setLocale, t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const breadcrumbs = useBreadcrumbs();

  const toggleLocale = () => {
    setLocale(locale === "ja" ? "en" : "ja");
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/10 bg-white/[0.02] px-6 backdrop-blur-md">
      {/* Breadcrumbs */}
      <nav
        className="flex items-center gap-1.5 text-sm"
        aria-label="Breadcrumb"
      >
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-white/30" />
            )}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="text-white/50 transition hover:text-white/80"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="font-medium text-white/90">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <button
          onClick={toggleLocale}
          className={cn(
            "flex items-center gap-1.5 rounded-none border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white",
          )}
          title={t.common.language}
        >
          <Globe className="h-3.5 w-3.5" />
          {localeLabels[locale]}
        </button>

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-none border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-teal-500/20 text-[10px] text-teal-200">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">
                  {user.name ?? user.email}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-white/10 bg-navy-950/95 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-white/70 hover:text-white focus:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t.auth.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
