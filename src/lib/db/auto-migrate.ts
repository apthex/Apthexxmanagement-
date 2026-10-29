import path from "node:path";
import fs from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { hashPassword } from "@/lib/auth/password";

let migrationPromise: Promise<void> | null = null;

export function ensurePgliteReady(client: PGlite): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        const check = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members');`
        );
        if (check.rows[0]?.exists) {
          return;
        }

        const migrationsFolder = path.resolve(process.cwd(), "drizzle");
        if (fs.existsSync(migrationsFolder)) {
          await migrate(drizzle(client), { migrationsFolder });
        } else {
          const initFile = path.resolve(process.cwd(), "drizzle/0000_init.sql");
          if (fs.existsSync(initFile)) {
            const sql = fs.readFileSync(initFile, "utf-8");
            for (const stmt of sql.split("--> statement-breakpoint")) {
              const trimmed = stmt.trim();
              if (trimmed) await client.query(trimmed).catch(() => {});
            }
          }
        }

        const checkCount = await client.query<{ count: string }>(`SELECT count(*) FROM members;`);
        if (parseInt(checkCount.rows[0]?.count || "0", 10) === 0) {
          const devId = "2fe5c0ca-eab2-490a-9dec-4aaca5928f98";
          const devPassHash = await hashPassword("Apthex-local-owner-2026");
          const now = new Date().toISOString();

          await client.query(`
            INSERT INTO members (id, name, email, role_title, access_level, joined_on, status, created_at, updated_at)
            VALUES ('${devId}', 'Devendra Hyalij', 'devendra@apthex.com', 'Founder & CTO', 'owner', '2025-01-15', 'active', '${now}', '${now}');
          `);

          await client.query(`
            INSERT INTO credentials (member_id, password_hash, created_by, created_at, updated_at)
            VALUES ('${devId}', '${devPassHash}', '${devId}', '${now}', '${now}');
          `);
        }
      } catch (error) {
        console.error("Auto-migrate warning:", error);
      }
    })();
  }
  return migrationPromise;
}
