import "./env";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { migrate as migrateNode } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL_MIGRATE;
  if (!url) {
    throw new Error(
      "DATABASE_URL_MIGRATE is required. Use the database OWNER/migration role — never the application role.",
    );
  }
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");

  if (url.startsWith("pglite://")) {
    const dir = path.resolve(process.cwd(), url.slice("pglite://".length) || "./.local-db");
    fs.mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    try {
      const database = drizzlePglite(client);
      await migratePglite(database, { migrationsFolder });
      console.log(`Local PGlite database migrated at ${dir}`);
    } finally {
      await client.close();
    }
    return;
  }

  const needsSsl = process.env.DATABASE_SSL !== "false" && !url.includes("localhost") && !url.includes("127.0.0.1");
  const pool = new Pool({ connectionString: url, max: 1, ssl: needsSsl ? { rejectUnauthorized: true } : false });
  try {
    const database = drizzleNode(pool);
    await migrateNode(database, { migrationsFolder });
    console.log("PostgreSQL migrated with the owner/migration role.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
