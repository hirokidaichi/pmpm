import { betterAuth } from "better-auth";
import { bearer, apiKey, deviceAuthorization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { ...schema, ...authSchema },
  }),

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },

  trustedOrigins: [
    process.env.WEB_ORIGIN ?? "http://localhost:3001",
  ],

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
