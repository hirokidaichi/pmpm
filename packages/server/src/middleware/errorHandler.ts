import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types.js";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Check if a UNIQUE constraint violation is present anywhere
 * in the error or its cause chain (handles DrizzleQueryError wrapping).
 */
function isUniqueConstraintError(err: Error): boolean {
  if (err.message?.includes("UNIQUE constraint failed")) return true;
  const cause = (err as any).cause;
  if (cause instanceof Error && cause.message?.includes("UNIQUE constraint failed")) return true;
  return false;
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode as 400,
    );
  }

  // ZodError handling (validation errors)
  if (err.name === "ZodError" && "issues" in err) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { issues: (err as { issues: unknown }).issues },
        },
      },
      400,
    );
  }

  // HTTPException handling (Hono throws this for malformed JSON, etc.)
  if (err instanceof HTTPException) {
    if (err.status === 400 && err.message?.includes("Malformed JSON")) {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        },
        400,
      );
    }
    return c.json(
      {
        error: {
          code: `HTTP_${err.status}`,
          message: err.message,
        },
      },
      err.status as 400,
    );
  }

  // SyntaxError handling (malformed JSON — may not be reached if Hono wraps it)
  if (err instanceof SyntaxError) {
    return c.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Invalid JSON in request body",
        },
      },
      400,
    );
  }

  // SQLite UNIQUE constraint violation (handles DrizzleQueryError wrapping)
  if (isUniqueConstraintError(err)) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: err.message,
        },
      },
      409,
    );
  }

  console.error("Unhandled error:", err);

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500,
  );
};
