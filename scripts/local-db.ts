import "./env";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL_MIGRATE ?? "pglite://./.local-db";
  if (!url.startsWith("pglite://")) {
    throw new Error("db:local only manages the local PGlite database");
  }
  const dir = path.resolve(process.cwd(), url.slice("pglite://".length) || "./.local-db");

  if (reset && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Removed local database.");
  }
  fs.mkdirSync(dir, { recursive: true });

  const client = new PGlite(dir);
  try {
    await migrate(drizzle(client), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log(`Local database ready: ${dir}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
