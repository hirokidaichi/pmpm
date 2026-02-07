import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import type { AppEnv } from "./types.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { auth } from "./auth/index.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { projectRoutes } from "./routes/project.js";
import { taskRoutes } from "./routes/task.js";
import { commentRoutes } from "./routes/comment.js";
import { timeRoutes } from "./routes/time.js";
import { dependencyRoutes } from "./routes/dependency.js";
import { documentRoutes } from "./routes/document.js";
import { inboxRoutes } from "./routes/inbox.js";
import { webhookRoutes } from "./routes/webhook.js";
import { fieldRoutes } from "./routes/field.js";
import { reportRoutes } from "./routes/report.js";
import { serverRoutes } from "./routes/server.js";
import { userRoutes } from "./routes/user.js";
import { milestoneRoutes } from "./routes/milestone.js";
import { riskRoutes } from "./routes/risk.js";
import { reminderRoutes } from "./routes/reminder.js";
import { dailyRoutes } from "./routes/daily.js";
import { ccpmRoutes } from "./routes/ccpm.js";
import { workflowRoutes } from "./routes/workflow.js";
import { setupRoutes } from "./routes/setup.js";
import { startScheduler } from "./scheduler.js";
import { autoMigrate } from "./db/auto-migrate.js";

const app = new Hono<AppEnv>();

// --- Middleware stack ---
app.use("*", requestId);
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  }),
);

// Auth middleware: resolve user from session/bearer/api-key
app.use("/api/*", async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("user", session?.user ?? null);
  c.set("membership", null);
  c.set("workspaceRole", null);
  c.set("projectRole", null);
  c.set("effectivePermission", "none");
  await next();
});

// Error handler
app.onError(errorHandler);

// --- Routes ---
app.route("/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/tasks", commentRoutes);       // /api/tasks/:taskId/comments/*
app.route("/api/time", timeRoutes);
app.route("/api/dependencies", dependencyRoutes);
app.route("/api/projects", documentRoutes);   // /api/projects/:projectId/documents/*
app.route("/api/inbox", inboxRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/fields", fieldRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/server", serverRoutes);
app.route("/api/users", userRoutes);
app.route("/api/milestones", milestoneRoutes);
app.route("/api/risks", riskRoutes);
app.route("/api/reminders", reminderRoutes);
app.route("/api/daily-reports", dailyRoutes);
app.route("/api/ccpm", ccpmRoutes);
app.route("/api/workflows", workflowRoutes);
app.route("/api/setup", setupRoutes);

// --- Export types for Hono RPC ---
export type AppType = typeof app;

// --- Start server ---
const port = Number(process.env.PORT ?? 3000);

autoMigrate()
  .then(() => {
    serve(
      { fetch: app.fetch, port },
      (info) => {
        console.log(`pmpm server listening on http://localhost:${info.port}`);
        startScheduler();
      },
    );
  })
  .catch((err) => {
    console.error("[Migration] Failed:", err);
    process.exit(1);
  });

export default app;
