import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client.js";

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "./drizzle" });
}
