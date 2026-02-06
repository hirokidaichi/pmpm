/**
 * テストデータ作成ヘルパー
 * 各ファクトリはデフォルト値を持ちつつ上書き可能
 */
import { ulid } from "ulid";
import type { Client } from "@libsql/client";

// ── Types ──

export interface TestUser {
  userId: string;
  displayName: string | null;
  alias: string | null;
  avatarUrl: string | null;
  timezone: string;
  role: "ADMIN" | "MEMBER" | "STAKEHOLDER";
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
}

export interface TestWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdBy: string;
}

export interface TestProject {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  ownerUserId: string | null;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  createdBy: string;
}

export interface TestTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  descriptionMd: string | null;
  stageId: string | null;
  importance: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  position: number;
  createdBy: string;
}

// ── Default values ──

let counter = 0;
function nextCounter(): number {
  return ++counter;
}

// テスト間でカウンタをリセット
export function resetFactoryCounter(): void {
  counter = 0;
}

// ── Factory functions ──

export async function createTestUser(
  client: Client,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const n = nextCounter();
  const now = Date.now();

  const user: TestUser = {
    userId: overrides.userId ?? ulid(),
    displayName: overrides.displayName ?? `Test User ${n}`,
    alias: overrides.alias ?? `testuser${n}`,
    avatarUrl: overrides.avatarUrl ?? null,
    timezone: overrides.timezone ?? "Asia/Tokyo",
    role: overrides.role ?? "MEMBER",
    status: overrides.status ?? "ACTIVE",
  };

  // Insert user profile
  await client.execute({
    sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, avatar_url, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      user.userId,
      user.displayName,
      user.alias,
      user.avatarUrl,
      user.timezone,
      now,
      now,
    ],
  });

  // Insert server membership
  await client.execute({
    sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [user.userId, user.role, user.status, now, now],
  });

  return user;
}

export async function createTestWorkspace(
  client: Client,
  overrides: Partial<TestWorkspace> & { createdBy?: string } = {},
): Promise<TestWorkspace> {
  const n = nextCounter();
  const now = Date.now();

  const workspace: TestWorkspace = {
    id: overrides.id ?? ulid(),
    name: overrides.name ?? `Test Workspace ${n}`,
    slug: overrides.slug ?? `test-ws-${n}`,
    description: overrides.description ?? null,
    createdBy: overrides.createdBy ?? ulid(),
  };

  await client.execute({
    sql: `INSERT INTO pm_workspace (id, name, slug, description, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      workspace.id,
      workspace.name,
      workspace.slug,
      workspace.description,
      workspace.createdBy,
      now,
      now,
    ],
  });

  return workspace;
}

export async function createTestProject(
  client: Client,
  overrides: Partial<TestProject> & {
    workspaceId?: string;
    createdBy?: string;
  } = {},
): Promise<TestProject> {
  const n = nextCounter();
  const now = Date.now();

  const project: TestProject = {
    id: overrides.id ?? ulid(),
    workspaceId: overrides.workspaceId ?? ulid(),
    name: overrides.name ?? `Test Project ${n}`,
    key: overrides.key ?? `TP${n}`,
    description: overrides.description ?? null,
    ownerUserId: overrides.ownerUserId ?? null,
    status: overrides.status ?? "ACTIVE",
    createdBy: overrides.createdBy ?? ulid(),
  };

  await client.execute({
    sql: `INSERT INTO pm_project (id, workspace_id, name, key, description, owner_user_id, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      project.id,
      project.workspaceId,
      project.name,
      project.key,
      project.description,
      project.ownerUserId,
      project.status,
      project.createdBy,
      now,
      now,
    ],
  });

  return project;
}

export async function createTestTask(
  client: Client,
  overrides: Partial<TestTask> & {
    projectId?: string;
    createdBy?: string;
  } = {},
): Promise<TestTask> {
  const n = nextCounter();
  const now = Date.now();

  const task: TestTask = {
    id: overrides.id ?? ulid(),
    projectId: overrides.projectId ?? ulid(),
    parentTaskId: overrides.parentTaskId ?? null,
    title: overrides.title ?? `Test Task ${n}`,
    descriptionMd: overrides.descriptionMd ?? null,
    stageId: overrides.stageId ?? null,
    importance: overrides.importance ?? "NORMAL",
    position: overrides.position ?? 0,
    createdBy: overrides.createdBy ?? ulid(),
  };

  await client.execute({
    sql: `INSERT INTO pm_task (id, project_id, parent_task_id, title, description_md, stage_id, importance, position, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      task.id,
      task.projectId,
      task.parentTaskId,
      task.title,
      task.descriptionMd,
      task.stageId,
      task.importance,
      task.position,
      task.createdBy,
      now,
      now,
    ],
  });

  return task;
}
