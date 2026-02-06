import { createMiddleware } from "hono/factory";
import { ulid } from "ulid";

export const requestId = createMiddleware(async (c, next) => {
  const id = ulid();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
});
