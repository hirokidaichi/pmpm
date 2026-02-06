export const dynamic = "force-dynamic";

import {
  Activity,
  CheckCircle2,
  Globe,
  HardDrive,
  Lock,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getHealth, getWorkspaces, getProjects, getTasks } from "@/lib/api";
import { ja } from "@/lib/i18n/ja";
import Link from "next/link";

async function fetchDashboardData() {
  const [health, workspaces, projects, tasks] = await Promise.allSettled([
    getHealth(),
    getWorkspaces({ limit: 1 }),
    getProjects({ limit: 1 }),
    getTasks({ limit: 1 }),
  ]);

  return {
    health: health.status === "fulfilled" ? health.value : null,
    workspaceCount:
      workspaces.status === "fulfilled" ? workspaces.value.total : null,
    projectCount:
      projects.status === "fulfilled" ? projects.value.total : null,
    taskCount: tasks.status === "fulfilled" ? tasks.value.total : null,
  };
}

export default async function HomePage() {
  const { health, workspaceCount, projectCount, taskCount } =
    await fetchDashboardData();

  const isOnline = !!health;

  const stats = [
    {
      label: ja.dashboard.stats.workspaces,
      value: workspaceCount ?? "—",
      href: "/workspaces",
    },
    {
      label: ja.dashboard.stats.projects,
      value: projectCount ?? "—",
      href: "/workspaces",
    },
    {
      label: ja.dashboard.stats.openTasks,
      value: taskCount ?? "—",
      href: null,
    },
    {
      label: ja.dashboard.stats.members,
      value: "—",
      href: null,
    },
  ];

  return (
    <div className="px-6 pb-20 pt-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Header */}
        <header className="glass-strong animate-fade-up rounded-[32px] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-200">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                  {ja.dashboard.subtitle}
                </p>
                <h1 className="font-display text-2xl text-white lg:text-3xl">
                  {ja.dashboard.title}
                </h1>
              </div>
            </div>
            <Badge
              variant={isOnline ? "success" : "default"}
              className="glass-chip w-fit"
            >
              <CheckCircle2 className="h-3 w-3" />
              {isOnline ? ja.dashboard.online : ja.dashboard.offline}
            </Badge>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-base text-white/70">
                CLI-firstのプロジェクト管理ツール。プロジェクト、ワークロード、自動化をモニタリングするグラスモーフィックダッシュボード。
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {process.env.NEXT_PUBLIC_PMPM_SERVER_URL ?? "localhost:3000"}
                </span>
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Better Auth
                </span>
                <span className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  libsql + Drizzle
                </span>
              </div>
            </div>

            <Card className="glass">
              <CardHeader>
                <CardTitle>{ja.dashboard.serverStatus}</CardTitle>
                <CardDescription>
                  {isOnline
                    ? `v${health?.version} — ${new Date(health?.timestamp ?? 0).toLocaleTimeString("ja-JP")}`
                    : "サーバー未接続"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">
                    {ja.dashboard.apiLatency}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {isOnline ? "OK" : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">
                    {ja.dashboard.webhooks}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {isOnline ? "Active" : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const inner = (
                <Card className="glass transition hover:border-white/20">
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                    <CardTitle className="text-3xl">{stat.value}</CardTitle>
                  </CardHeader>
                </Card>
              );
              return stat.href ? (
                <Link key={stat.label} href={stat.href}>
                  {inner}
                </Link>
              ) : (
                <div key={stat.label}>{inner}</div>
              );
            })}
          </div>
        </section>

        {/* Quick Nav */}
        <section
          className="grid gap-6 lg:grid-cols-2 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle>ナビゲーション</CardTitle>
              <CardDescription>主要機能へのショートカット</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: ja.nav.workspaces,
                  href: "/workspaces",
                  desc: "チーム・部門のワークスペースを管理",
                },
                {
                  label: ja.nav.inbox,
                  href: "/inbox",
                  desc: "通知・メッセージを確認",
                },
                {
                  label: ja.nav.reports,
                  href: "/reports",
                  desc: "プロジェクトレポートを表示",
                },
                {
                  label: ja.nav.daily,
                  href: "/daily",
                  desc: "日報の確認・作成",
                },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 text-teal-200">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">{item.label}</p>
                      <p className="text-xs text-white/50">{item.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>CLI コマンド</CardTitle>
              <CardDescription>よく使うコマンド</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "認証", cmd: "pmpm auth login" },
                { label: "プロジェクト一覧", cmd: "pmpm project list --format json" },
                { label: "タスク一覧", cmd: 'pmpm task list --status "Open"' },
                { label: "タイマー開始", cmd: "pmpm time start --task <id>" },
              ].map((item) => (
                <div
                  key={item.cmd}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    {item.label}
                  </p>
                  <pre className="mt-2 text-sm text-white/90">
                    <code>{item.cmd}</code>
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
