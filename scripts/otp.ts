import "./env";
import { isNull, sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";
import { credentials, members } from "@/lib/db/schema";
import { hotpCode, currentStep } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";

async function main() {
  if (env.isProduction) throw new Error("Refusing to print a TOTP code in production");
  const email = (process.argv[2] ?? process.env.SEED_OWNER_EMAIL ?? "devendra@apthex.test").toLowerCase();
  const [row] = await db
    .select({ member: members, credential: credentials })
    .from(members)
    .innerJoin(credentials, sql`${credentials.memberId} = ${members.id}`)
    .where(sql`lower(${members.email}) = ${email} and ${isNull(members.deletedAt)}`)
    .limit(1);
  if (!row?.credential.totpSecret) {
    console.error("No enrolled TOTP secret for", email);
    process.exit(1);
  }
  const secret = decryptSecret(row.credential.totpSecret, env.encryptionKey);
  const step = currentStep();
  console.log(`Email: ${row.member.email}`);
  console.log(`TOTP:  ${hotpCode(secret, step)} (valid for ${30 - (Math.floor(Date.now() / 1000) % 30)}s)`);
  console.log(`Secret: ${secret}`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
