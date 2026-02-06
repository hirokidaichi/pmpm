import { Hono } from "hono";
import { auth } from "../auth/index.js";
import type { AppEnv } from "../types.js";

export const authRoutes = new Hono<AppEnv>().on(
  ["GET", "POST"],
  "/*",
  async (c) => {
    return auth.handler(c.req.raw);
  },
);
