import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../types.js";
import { auth } from "../auth/index.js";
import { db } from "../db/client.js";
import { pmUserProfile, pmServerMembership } from "../db/schema.js";
import { user } from "../db/auth-schema.js";
import { AppError } from "../middleware/errorHandler.js";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

async function getUserCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user);
  return result[0]?.count ?? 0;
}

export const setupRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const count = await getUserCount();
    return c.json({ needsSetup: count === 0 });
  })
  .post("/", zValidator("json", setupSchema), async (c) => {
    const count = await getUserCount();
    if (count > 0) {
      throw new AppError(
        "SETUP_ALREADY_COMPLETE",
        "Server already has users. Initial setup can only run on a fresh server.",
        409,
      );
    }

    const { email, password, name } = c.req.valid("json");
    const timestamp = Date.now();

    const signupResponse = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    const userId = signupResponse.user.id;

    await db.insert(pmUserProfile).values({
      userId,
      displayName: name,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.insert(pmServerMembership).values({
      userId,
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return c.json(
      {
        user: signupResponse.user,
        message: "Server setup complete. You are now the admin.",
      },
      201,
    );
  });
