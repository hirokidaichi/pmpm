import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/pmpm.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
