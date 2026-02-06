import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { pmServerMembership } from "../db/schema.js";
import type { AppEnv } from "../types.js";

type Role = "ADMIN" | "MEMBER" | "STAKEHOLDER";

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  MEMBER: 2,
  STAKEHOLDER: 1,
};

export function requireRole(minRole: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401,
      );
    }

    const membership = await db.query.pmServerMembership.findFirst({
      where: eq(pmServerMembership.userId, user.id),
    });

    if (!membership || membership.status !== "ACTIVE") {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Active server membership required",
          },
        },
        403,
      );
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      return c.json(
        {
          error: {
            code: "INSUFFICIENT_ROLE",
            message: `This action requires ${minRole} role or higher`,
          },
        },
        403,
      );
    }

    c.set("membership", membership);
    await next();
  });
}
