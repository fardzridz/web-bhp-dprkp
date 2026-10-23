import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;
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

let cachedDb: Database | null = null;

export function getDb(): Database {
  if (cachedDb) return cachedDb;
  const d1 = resolveD1Binding();
  if (d1) {
    cachedDb = drizzle(d1 as unknown as Parameters<typeof drizzle>[0], { schema });
    return cachedDb;
  }

  // Fallback dummy D1 client for build-time static evaluation
  const dummyD1 = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] }),
        get: async () => null,
        run: async () => ({ success: true }),
      }),
      all: async () => ({ results: [] }),
      get: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return drizzle(dummyD1 as unknown as Parameters<typeof drizzle>[0], { schema });
}

export const db: Database = new Proxy({} as unknown as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
