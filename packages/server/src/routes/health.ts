import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const healthRoutes = new Hono<AppEnv>().get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    version: "0.1.0",
  });
});
