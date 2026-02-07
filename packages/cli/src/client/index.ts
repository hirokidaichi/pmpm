import { EXIT_CODES } from "@pmpm/shared/constants";
import { resolveAuth, resolveServerUrl } from "../config/index.js";

// ── Types ──

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class PmpmApiError extends Error {
  public readonly hint?: string;

  constructor(
    public readonly statusCode: number,
    public readonly apiError: ApiError,
    public readonly exitCode: number,
    hint?: string
  ) {
    super(apiError.message);
    this.name = "PmpmApiError";
    this.hint = hint;
  }

  /** Full error string with details and hint for CLI display */
  formatFull(): string {
    const parts = [this.message];
    if (this.apiError.details) {
      parts.push(formatDetails(this.apiError.details));
    }
    if (this.hint) {
      parts.push(`Hint: ${this.hint}`);
    }
    return parts.join("\n");
  }
}

function formatDetails(details: unknown): string {
  if (typeof details === "string") return details;
  if (Array.isArray(details)) {
    return details
      .map((d) => {
        if (typeof d === "object" && d !== null) {
          const obj = d as Record<string, unknown>;
          const field = obj.field || obj.path;
          const msg = obj.message || obj.msg;
          if (field && msg) return `  - ${field}: ${msg}`;
          if (msg) return `  - ${msg}`;
        }
        return `  - ${String(d)}`;
      })
      .join("\n");
  }
  if (typeof details === "object" && details !== null) {
    return Object.entries(details as Record<string, unknown>)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");
  }
  return String(details);
}

function hintForStatus(status: number): string | undefined {
  switch (status) {
    case 401:
      return "Run 'pmpm auth login' to authenticate.";
    case 403:
      return "Check that you have the required role for this operation.";
    case 404:
      return "Verify the ID or slug is correct with the corresponding 'list' command.";
    case 422:
      return "Check the required fields and their formats.";
    default:
      return undefined;
  }
}

// ── Error Mapping ──

function statusToExitCode(status: number): number {
  switch (status) {
    case 401:
      return EXIT_CODES.AUTH_ERROR;
    case 403:
      return EXIT_CODES.PERMISSION_DENIED;
    case 404:
      return EXIT_CODES.NOT_FOUND;
    case 422:
      return EXIT_CODES.VALIDATION_ERROR;
    default:
      return EXIT_CODES.GENERAL_ERROR;
  }
}

function formatErrorMessage(status: number, body: ApiError | string): string {
  if (typeof body === "object" && body.message) {
    return body.message;
  }
  switch (status) {
    case 401:
      return "Authentication required. Run 'pmpm auth login' first.";
    case 403:
      return "Permission denied. You don't have access to this resource.";
    case 404:
      return "Resource not found.";
    case 422:
      return "Invalid request. Check your arguments.";
    case 500:
      return "Internal server error. Please try again later.";
    default:
      return `Server responded with status ${status}`;
  }
}

// ── API Client ──

export interface ClientOptions {
  token?: string;
  profile?: string;
  server?: string;
  debug?: boolean;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  opts: ClientOptions & { body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const serverUrl = resolveServerUrl({ server: opts.server });
  const auth = resolveAuth({ token: opts.token, profile: opts.profile });

  const url = new URL(path, serverUrl);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: serverUrl,
  };

  if (auth) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }

  if (opts.debug) {
    console.error(`[DEBUG] ${method} ${url.toString()}`);
    if (opts.body) {
      console.error(`[DEBUG] Body: ${JSON.stringify(opts.body)}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new PmpmApiError(
      0,
      {
        code: "NETWORK_ERROR",
        message: `Cannot connect to server at ${serverUrl}. Is the server running?`,
      },
      EXIT_CODES.NETWORK_ERROR,
      "Check the server URL with 'pmpm config show' or start the server with 'pmpm server start'."
    );
  }

  if (opts.debug) {
    console.error(`[DEBUG] Response: ${response.status}`);
  }

  if (!response.ok) {
    let body: ApiError | string;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      body = await response.text();
    }

    const apiError: ApiError =
      typeof body === "object"
        ? body
        : {
            code: "UNKNOWN_ERROR",
            message: formatErrorMessage(response.status, body),
          };

    if (!apiError.message) {
      apiError.message = formatErrorMessage(response.status, apiError);
    }

    throw new PmpmApiError(
      response.status,
      apiError,
      statusToExitCode(response.status),
      hintForStatus(response.status)
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ── Convenience Methods ──

export function get<T>(
  path: string,
  opts: ClientOptions & { query?: Record<string, string> } = {}
): Promise<T> {
  return apiRequest<T>("GET", path, opts);
}

export function post<T>(
  path: string,
  body: unknown,
  opts: ClientOptions = {}
): Promise<T> {
  return apiRequest<T>("POST", path, { ...opts, body });
}

export function put<T>(
  path: string,
  body: unknown,
  opts: ClientOptions = {}
): Promise<T> {
  return apiRequest<T>("PUT", path, { ...opts, body });
}

export function patch<T>(
  path: string,
  body: unknown,
  opts: ClientOptions = {}
): Promise<T> {
  return apiRequest<T>("PATCH", path, { ...opts, body });
}

export function del<T>(path: string, opts: ClientOptions = {}): Promise<T> {
  return apiRequest<T>("DELETE", path, opts);
}

// ── Global Options Extraction ──

export function extractClientOpts(cmdOpts: Record<string, unknown>): ClientOptions {
  return {
    token: cmdOpts.token as string | undefined,
    profile: cmdOpts.profile as string | undefined,
    server: cmdOpts.server as string | undefined,
    debug: cmdOpts.debug as boolean | undefined,
  };
}
