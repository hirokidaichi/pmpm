import { api, buildQuery } from "./client";

// ── Pagination envelope ──
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Health ──
export interface HealthResponse {
  status: string;
  timestamp: number;
  version: string;
}

export const getHealth = () =>
  api.get<HealthResponse>("/health", { next: { revalidate: 10 } });

// ── Workspaces ──
export const getWorkspaces = (params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/workspaces${buildQuery(params ?? {})}`);

export const getWorkspace = (id: string) =>
  api.get<Record<string, unknown>>(`/api/workspaces/${id}`);

// ── Projects ──
export const getProjects = (params?: {
  workspaceId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/projects${buildQuery(params ?? {})}`);

export const getProject = (id: string) =>
  api.get<Record<string, unknown>>(`/api/projects/${id}`);

// ── Tasks ──
export const getTasks = (params?: {
  projectId?: string;
  stageId?: string;
  importance?: string;
  assigneeUserId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}) => api.get<Paginated<Record<string, unknown>>>(`/api/tasks${buildQuery(params ?? {})}`);

export const getTask = (id: string) =>
  api.get<Record<string, unknown>>(`/api/tasks/${id}`);

// ── Comments ──
export const getComments = (
  taskId: string,
  params?: { limit?: number; offset?: number; order?: string },
) =>
  api.get<Paginated<Record<string, unknown>>>(
    `/api/tasks/${taskId}/comments${buildQuery(params ?? {})}`,
  );

// ── Milestones ──
export const getMilestones = (params: {
  projectId: string;
  status?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/milestones${buildQuery(params)}`);

// ── Risks ──
export const getRisks = (params: {
  projectId: string;
  status?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/risks${buildQuery(params)}`);

// ── Reports ──
export const getReportSummary = (projectId: string) =>
  api.get<{
    projectId: string;
    total: number;
    overdue: number;
    byCategory: { category: string; count: number }[];
    byImportance: { importance: string; count: number }[];
  }>(`/api/reports/summary?projectId=${projectId}`);

export const getReportWorkload = (projectId?: string) =>
  api.get<{ userId: string; count: number }[]>(
    `/api/reports/workload${buildQuery({ projectId })}`,
  );

export const getReportTime = (params?: {
  projectId?: string;
  userId?: string;
  from?: number;
  to?: number;
}) =>
  api.get<{ userId: string; totalMinutes: number; entryCount: number }[]>(
    `/api/reports/time${buildQuery(params ?? {})}`,
  );

// ── Inbox ──
export const getInbox = (params?: {
  unreadOnly?: boolean;
  messageType?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/inbox${buildQuery(params ?? {})}`);

export const getInboxCount = () =>
  api.get<{ unread: number }>("/api/inbox/count");

// ── Time ──
export const getTimerStatus = () =>
  api.get<Record<string, unknown> | null>("/api/time/status");

export const getTimeEntries = (params?: {
  taskId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/time/entries${buildQuery(params ?? {})}`);

export const getTimeCategories = () =>
  api.get<Record<string, unknown>[]>("/api/time/categories");

// ── Documents ──
export const getDocuments = (
  projectId: string,
  params?: { parentDocumentId?: string; limit?: number; offset?: number },
) =>
  api.get<Paginated<Record<string, unknown>>>(
    `/api/projects/${projectId}/documents${buildQuery(params ?? {})}`,
  );

export const getDocumentTree = (projectId: string) =>
  api.get<Record<string, unknown>[]>(
    `/api/projects/${projectId}/documents/tree`,
  );

// ── Dependencies ──
export const getTaskDependencies = (taskId: string) =>
  api.get<{
    predecessors: Record<string, unknown>[];
    successors: Record<string, unknown>[];
  }>(`/api/dependencies/task/${taskId}`);

// ── Daily Reports ──
export const getDailyReports = (params?: {
  userId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) =>
  api.get<Paginated<Record<string, unknown>>>(
    `/api/daily-reports${buildQuery(params ?? {})}`,
  );

export const getDailyPreview = (params: {
  reportDate: string;
  projectId?: string;
}) => api.get<Record<string, unknown>>(`/api/daily-reports/preview${buildQuery(params)}`);

// ── Users ──
export const getCurrentUser = () =>
  api.get<Record<string, unknown>>("/api/users/me");

export const getUsers = (params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/users${buildQuery(params ?? {})}`);

// ── Reminders ──
export const getReminders = (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) => api.get<Paginated<Record<string, unknown>>>(`/api/reminders${buildQuery(params ?? {})}`);
