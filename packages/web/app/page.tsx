import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Command,
  Globe,
  HardDrive,
  Lock,
  Server,
  Shield,
  Terminal,
  Users2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const stats = [
  { label: "Workspaces", value: "12", hint: "+2 this week" },
  { label: "Projects", value: "38", hint: "4 in review" },
  { label: "Open Tasks", value: "214", hint: "18 due soon" },
  { label: "Members", value: "64", hint: "8 guests" }
];

const activity = [
  {
    title: "Device flow login verified",
    meta: "auth", 
    time: "2m ago"
  },
  {
    title: "Webhook delivery success",
    meta: "webhooks", 
    time: "18m ago"
  },
  {
    title: "Project BE status updated",
    meta: "projects", 
    time: "42m ago"
  },
  {
    title: "Risk register synced",
    meta: "risk", 
    time: "1h ago"
  }
];

const quickActions = [
  {
    title: "Create workspace",
    detail: "Bootstrap a new team space",
    icon: Users2
  },
  {
    title: "Start task sprint",
    detail: "Open a new milestone window",
    icon: Activity
  },
  {
    title: "Run report",
    detail: "Daily summary and velocity",
    icon: Command
  }
];

export default function HomePage() {
  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="glass-strong animate-fade-up rounded-[32px] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-200">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                  pmpm server console
                </p>
                <h1 className="font-display text-3xl text-white lg:text-4xl">
                  Control surface for CLI-first work
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success" className="glass-chip">
                <CheckCircle2 className="h-3 w-3" />
                Online
              </Badge>
              <Button variant="outline">API docs</Button>
              <Button>Open CLI</Button>
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-base text-white/70">
                A glassmorphic dashboard for monitoring projects, workloads, and
                automation across your pmpm server. Designed for fast handoff
                between humans, scripts, and AI agents.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Input placeholder="http://localhost:3000" />
                </div>
                <Button className="sm:w-auto">Connect server</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  PMPM_SERVER_URL
                </span>
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Device flow auth
                </span>
                <span className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  libsql + drizzle
                </span>
              </div>
            </div>
            <Card className="glass">
              <CardHeader>
                <CardTitle>Server status</CardTitle>
                <CardDescription>Live snapshot of core services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">API latency</span>
                  <span className="text-sm font-semibold text-white">84 ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Worker queue</span>
                  <span className="text-sm font-semibold text-white">0 pending</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Auth sessions</span>
                  <span className="text-sm font-semibold text-white">24 active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Webhooks</span>
                  <span className="text-sm font-semibold text-white">All green</span>
                </div>
                <Button variant="outline" className="w-full">
                  View diagnostics
                </Button>
              </CardContent>
            </Card>
          </div>
        </header>

        <section className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="glass">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="text-3xl">{stat.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/60">{stat.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>What just happened on the server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity.map((item, index) => (
                <div key={item.title} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{item.title}</p>
                      <p className="text-xs text-white/50">{item.meta}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{item.time}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </div>
                  {index < activity.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Common control flows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quickActions.map((action) => (
                <div
                  key={action.title}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 text-teal-200">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{action.title}</p>
                    <p className="text-xs text-white/50">{action.detail}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Run
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section
          className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle>Security posture</CardTitle>
              <CardDescription>Auth and policy overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-teal-300" />
                  <span className="text-sm text-white/70">Admin roles</span>
                </div>
                <span className="text-sm text-white">4 active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Terminal className="h-4 w-4 text-teal-300" />
                  <span className="text-sm text-white/70">API keys</span>
                </div>
                <span className="text-sm text-white">11 valid</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-teal-300" />
                  <span className="text-sm text-white/70">Device flow</span>
                </div>
                <span className="text-sm text-white">Enabled</span>
              </div>
              <Button variant="outline" className="w-full">
                Review policies
              </Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>CLI launchpad</CardTitle>
              <CardDescription>Copy ready commands</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Auth</p>
                <pre className="mt-3 text-sm text-white/90">
                  <code>pmpm auth login</code>
                </pre>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Projects</p>
                <pre className="mt-3 text-sm text-white/90">
                  <code>pmpm project list --format json</code>
                </pre>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Tasks</p>
                <pre className="mt-3 text-sm text-white/90">
                  <code>pmpm task list --status "Open" --assignee me</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
