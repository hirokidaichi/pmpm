const BASE_URL =
  process.env.NEXT_PUBLIC_PMPM_SERVER_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  headers?: Record<string, string>;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
};

async function getServerCookies(): Promise<string | undefined> {
  try {
    // Dynamic import so this doesn't break client-side bundles
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.toString();
  } catch {
    return undefined;
  }
}

async function request<T>(
  path: string,
  options: RequestOptions & RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const { headers: customHeaders, next: nextConfig, signal, ...rest } = options;

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string> | undefined),
  };

  // Forward cookies from incoming request when running server-side (SSR)
  if (typeof window === "undefined") {
    const cookie = await getServerCookies();
    if (cookie) {
      reqHeaders["Cookie"] = cookie;
    }
  }

  const res = await fetch(url, {
    ...rest,
    signal,
    credentials: "include",
    headers: reqHeaders,
    next: nextConfig,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
      body?.error?.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "GET", ...opts }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...opts }),
};

export function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}
