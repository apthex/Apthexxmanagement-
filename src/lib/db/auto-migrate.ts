import type { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "@/lib/auth/password";
import { INIT_SQL } from "./init-sql";

let migrationPromise: Promise<void> | null = null;

export function ensurePgliteReady(client: PGlite): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        const check = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits');`
        );
        if (check.rows[0]?.exists) {
          return;
        }

        // Clean statements from Drizzle comment breakpoints and run atomically
        const cleanSql = INIT_SQL.replace(/--> statement-breakpoint/g, ";\n");
        await client.exec(cleanSql);

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
