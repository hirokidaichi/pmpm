import { betterAuth } from "better-auth";
import { bearer, apiKey, deviceAuthorization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    deviceAuthorization(),
    bearer(),
    apiKey(),
  ],

  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
});

export type Auth = typeof auth;
