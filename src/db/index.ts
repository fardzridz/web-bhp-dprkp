import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Single instance for local development / node runtime
const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
