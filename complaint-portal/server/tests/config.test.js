import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const checkScript = fileURLToPath(new URL("./assert-production.mjs", import.meta.url));

function baseProductionEnv() {
  return {
    ...process.env,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://127.0.0.1:27017/test",
    DATABASE_NAME: "apthex_complaint_portal",
    APP_BASE_URL: "https://example.com",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    TOTP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "test@example.com",
    APTHEX_CASE_MAILBOX: "case@test.local",
    URGENT_ALERT_RECIPIENTS: "urgent@test.local",
    CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000000000000000000000000000000000000",
    CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x000000000000000000000000000000000000000000000000000000000000000000",
    CAPTCHA_DEV_BYPASS: "false",
    // Keep production posture explicit (dev .env sets this false; dotenv would leak it here).
    AUTH_REQUIRE_2FA: "true",
    AUTO_SEED: "false",
    RETENTION_DAYS: "30",
    ESCALATION_DAYS: "7",
  };
}

test("production config fails safely when required values are missing", () => {
  const env = baseProductionEnv();
  delete env.CLOUDFLARE_TURNSTILE_SITE_KEY;
  let threw = false;
  let output = "";
  try {
    execFileSync(process.execPath, [checkScript], { env, stdio: "pipe" });
  } catch (error) {
    threw = true;
    output = (error.stdout && error.stdout.toString()) || "";
    output += (error.stderr && error.stderr.toString()) || "";
  }
  assert.strictEqual(threw, true, "assertProductionConfig should throw in production without CLOUDFLARE_TURNSTILE_SITE_KEY");
  assert.ok(output.includes("CLOUDFLARE_TURNSTILE_SITE_KEY"), `expected CLOUDFLARE_TURNSTILE_SITE_KEY in error, got:\n${output}`);
});

test("production config accepts all required values", () => {
  const env = baseProductionEnv();
  let threw = false;
  let output = "";
  try {
    execFileSync(process.execPath, [checkScript], { env, stdio: "pipe" });
  } catch (error) {
    threw = true;
    output = (error.stdout && error.stdout.toString()) || "";
    output += (error.stderr && error.stderr.toString()) || "";
  }
  assert.strictEqual(threw, false, `assertProductionConfig should not throw when all required values are set, got:\n${output}`);
});
