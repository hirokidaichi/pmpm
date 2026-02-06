/**
 * Resolves human-friendly identifiers (workspace slug, project key)
 * to internal ULID IDs by querying the server API.
 */
import { get, type ClientOptions } from "./index.js";
import { PmpmApiError } from "./index.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

interface WorkspaceItem {
  id: string;
  slug: string;
  name: string;
}

interface ProjectItem {
  id: string;
  key: string;
  name: string;
  workspaceId: string;
}

/**
 * Resolve a workspace slug (or ID) to a workspace ID.
 * Fetches the workspace list and finds by slug match.
 * If the input looks like a ULID (26 chars), tries as-is first.
 */
export async function resolveWorkspaceId(
  slugOrId: string,
  opts: ClientOptions,
): Promise<string> {
  // If it looks like a ULID (26 uppercase alphanumeric), use directly
  if (/^[0-9A-Z]{26}$/.test(slugOrId)) {
    return slugOrId;
  }

  const result = await get<{ items: WorkspaceItem[] }>("/api/workspaces", opts);
  const ws = result.items.find((w) => w.slug === slugOrId);
  if (!ws) {
    throw new PmpmApiError(
      404,
      {
        code: "WORKSPACE_NOT_FOUND",
        message: `Workspace '${slugOrId}' not found`,
      },
      EXIT_CODES.NOT_FOUND,
    );
  }
  return ws.id;
}

/**
 * Resolve a project key (or ID) to a project ID within a workspace.
 * Fetches the project list filtered by workspace and finds by key match.
 */
export async function resolveProjectId(
  workspaceId: string,
  keyOrId: string,
  opts: ClientOptions,
): Promise<string> {
  // If it looks like a ULID, use directly
  if (/^[0-9A-Z]{26}$/.test(keyOrId)) {
    return keyOrId;
  }

  const result = await get<{ items: ProjectItem[] }>("/api/projects", {
    ...opts,
    query: { workspaceId },
  });
  const proj = result.items.find((p) => p.key === keyOrId);
  if (!proj) {
    throw new PmpmApiError(
      404,
      {
        code: "PROJECT_NOT_FOUND",
        message: `Project '${keyOrId}' not found in workspace`,
      },
      EXIT_CODES.NOT_FOUND,
    );
  }
  return proj.id;
}

/**
 * Resolve both workspace slug and project key to IDs in one step.
 */
export async function resolveWorkspaceAndProject(
  workspaceSlug: string,
  projectKey: string,
  opts: ClientOptions,
): Promise<{ workspaceId: string; projectId: string }> {
  const workspaceId = await resolveWorkspaceId(workspaceSlug, opts);
  const projectId = await resolveProjectId(workspaceId, projectKey, opts);
  return { workspaceId, projectId };
}
