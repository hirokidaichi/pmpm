import { betterAuth } from "better-auth";
import { bearer, apiKey, deviceAuthorization } from "better-auth/plugins";
import { db } from "../db/client.js";

export const auth = betterAuth({
  database: db,

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
