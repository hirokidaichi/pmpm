import { zodResolver as baseZodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Wrapper around @hookform/resolvers/zod that handles the Zod v4 type
 * compatibility issue. The resolver's type declarations expect `zod/v4/core`
 * types, but the main `zod` export wraps them with a different version marker.
 * At runtime, the resolver correctly detects and handles both Zod 3 and 4
 * schemas, so the cast here is safe.
 */
export function zodResolver<T extends FieldValues>(
  schema: ZodType,
): Resolver<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return baseZodResolver(schema as any) as Resolver<T>;
}
