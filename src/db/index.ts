import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleD1, type DrizzleD1Database } from "drizzle-orm/d1";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;
interface D1BindingLike {
  prepare(query: string): unknown;
}

function hasPrepare(candidate: unknown): candidate is D1BindingLike {
  if (typeof candidate !== "object" || candidate === null || !("prepare" in candidate)) {
    return false;
  }
  const prepareFn = candidate.prepare;
  return typeof prepareFn === "function";
}

function resolveD1Binding(): D1BindingLike | null {
  if (typeof process !== "undefined" && typeof process.env === "object" && process.env !== null) {
    if ("DB" in process.env && hasPrepare(process.env.DB)) {
      return process.env.DB;
    }
  }
  if (typeof globalThis === "object" && globalThis !== null) {
    const globalRecord: Record<string | symbol, unknown> = globalThis;
    if ("DB" in globalRecord && hasPrepare(globalRecord.DB)) {
      return globalRecord.DB;
    }
    const cfSymbol = Symbol.for("__cloudflare-context__");
    if (cfSymbol in globalRecord) {
      const holder = globalRecord[cfSymbol];
      if (holder && typeof holder === "object" && "env" in holder) {
        const envObj = holder.env;
        if (envObj && typeof envObj === "object" && "DB" in envObj && hasPrepare(envObj.DB)) {
          return envObj.DB;
        }
      }
    }
  }
  return null;
}

let cachedLibsqlDb: LibSQLDatabase<typeof schema> | null = null;

export function getDb(): Database {
  const d1 = resolveD1Binding();
  if (d1) {
    return drizzleD1(d1 as unknown as Parameters<typeof drizzleD1>[0], { schema }) as unknown as Database;
  }

  if (!cachedLibsqlDb) {
    const client = createClient({
      url: process.env.DATABASE_URL || "file:local.sqlite",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    cachedLibsqlDb = drizzleLibsql(client, { schema });
  }
  return cachedLibsqlDb;
}

export const db: Database = new Proxy({} as unknown as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
