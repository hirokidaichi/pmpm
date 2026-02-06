import { get, type ClientOptions } from "../client/index.js";
import { printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

interface Workspace {
  id: string;
  slug: string;
  [key: string]: unknown;
}

interface Project {
  id: string;
  key: string;
  [key: string]: unknown;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Resolve a workspace slug to its ID by searching the workspace list.
 */
export async function resolveWorkspaceId(
  slug: string,
  clientOpts: ClientOptions,
): Promise<string> {
  const result = await get<PaginatedResponse<Workspace>>("/api/workspaces", clientOpts);
  const match = result.items.find((ws) => ws.slug === slug);
  if (!match) {
    printError(`Workspace '${slug}' not found.`);
    process.exit(EXIT_CODES.NOT_FOUND);
  }
  return match.id;
}

/**
 * Resolve a project key to its ID by searching within a workspace.
 */
export async function resolveProjectId(
  key: string,
  workspaceId: string,
  clientOpts: ClientOptions,
): Promise<string> {
  const result = await get<PaginatedResponse<Project>>("/api/projects", {
    ...clientOpts,
    query: { workspaceId },
  });
  const match = result.items.find((p) => p.key === key);
  if (!match) {
    printError(`Project '${key}' not found in workspace.`);
    process.exit(EXIT_CODES.NOT_FOUND);
  }
  return match.id;
}

/**
 * Convert a date string (YYYY-MM-DD) to epoch milliseconds.
 */
export function dateToEpoch(dateStr: string): number {
  return new Date(dateStr).getTime();
}
