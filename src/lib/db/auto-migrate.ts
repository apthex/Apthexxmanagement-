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
        if (!check.rows[0]?.exists) {
          // Clean statements from Drizzle comment breakpoints and run atomically
          const cleanSql = INIT_SQL.replace(/--> statement-breakpoint/g, ";\n");
          await client.exec(cleanSql);
        }

        const now = new Date().toISOString();

        // Clear any rate limits and locks to avoid false lockouts
        await client.query(`DELETE FROM rate_limits;`).catch(() => {});
        await client.query(`UPDATE credentials SET locked_until = NULL;`).catch(() => {});

        // 1. Ensure apthexx@gmail.com exists with password Apthex2026@# as owner
        const userEmail = "apthexx@gmail.com";
        const userPassHash = await hashPassword("Apthex2026@#");

        const userCheck = await client.query<{ id: string }>(
          `SELECT id FROM members WHERE lower(email) = '${userEmail}';`
        );
        if (userCheck.rows.length === 0) {
          const userId = "a1111111-2222-3333-4444-555555555555";
          await client.query(`
            INSERT INTO members (id, name, email, role_title, access_level, joined_on, status, created_at, updated_at)
            VALUES ('${userId}', 'Apthex Admin', '${userEmail}', 'Owner & Administrator', 'owner', '2025-01-15', 'active', '${now}', '${now}');
          `);
          await client.query(`
            INSERT INTO credentials (member_id, password_hash, created_by, created_at, updated_at)
            VALUES ('${userId}', '${userPassHash}', '${userId}', '${now}', '${now}');
          `);
        } else {
          const memberId = userCheck.rows[0].id;
          await client.query(`
            UPDATE credentials SET password_hash = '${userPassHash}', updated_at = '${now}' WHERE member_id = '${memberId}';
          `);
          await client.query(`
            UPDATE members SET status = 'active', access_level = 'owner', updated_at = '${now}' WHERE id = '${memberId}';
          `);
        }

        // 2. Ensure fallback devendra@apthex.com also exists
        const devCheck = await client.query<{ id: string }>(
          `SELECT id FROM members WHERE lower(email) = 'devendra@apthex.com';`
        );
        if (devCheck.rows.length === 0) {
          const devId = "2fe5c0ca-eab2-490a-9dec-4aaca5928f98";
          const devPassHash = await hashPassword("Apthex-local-owner-2026");
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
