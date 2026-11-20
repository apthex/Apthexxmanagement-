import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import path from "node:path";
import * as schema from "./schema";
import { ensurePgliteReady } from "./auto-migrate";

/**
 * Production: PostgreSQL (Neon/Supabase/any Postgres) through `pg`.
 * Local: PGlite (PostgreSQL compiled to WASM), persisted to .local-db/.
 *
 * Both expose the same Drizzle query builder. Nothing in application code
 * branches on the driver.
 */
export type AppDatabase = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __apthexDb?: AppDatabase;
  __apthexPool?: Pool;
  __apthexPglite?: PGlite;
};

export function localDbPathFromUrl(url: string): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.resolve("/tmp", ".local-db");
  }
  const raw = url.slice("pglite://".length) || "./.local-db";
  return path.resolve(process.cwd(), raw);
}

export function makePgliteDb(client: PGlite): AppDatabase {
  return drizzlePglite(client, { schema }) as unknown as AppDatabase;
}

export function makeNodeDb(pool: Pool): AppDatabase {
  return drizzleNode(pool, { schema }) as unknown as AppDatabase;
}

function build(): AppDatabase {
  const url = process.env.DATABASE_URL?.trim();

  if (!url || url.startsWith("pglite://")) {
    const dir = localDbPathFromUrl(url ?? "pglite://./.local-db");
    const client = new PGlite(dir);
    globalForDb.__apthexPglite = client;
    ensurePgliteReady(client);
    return makePgliteDb(client);
  }

  const needsSsl = process.env.DATABASE_SSL !== "false" && !url.includes("localhost") && !url.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
  });
  globalForDb.__apthexPool = pool;
  return makeNodeDb(pool);
}

export function getDb(): AppDatabase {
  if (!globalForDb.__apthexDb) {
    globalForDb.__apthexDb = build();
  }
  return globalForDb.__apthexDb;
}

/** Lazy proxy so importing the module at build time never opens a connection. */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function closeDb(): Promise<void> {
  if (globalForDb.__apthexPool) {
    await globalForDb.__apthexPool.end();
    globalForDb.__apthexPool = undefined;
  }
  if (globalForDb.__apthexPglite) {
    await globalForDb.__apthexPglite.close();
    globalForDb.__apthexPglite = undefined;
  }
  globalForDb.__apthexDb = undefined;
}

export async function pingDb(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export { schema };
export * from "./schema";
