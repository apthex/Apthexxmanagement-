import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  MONGODB_URI: z.string().optional(),
  DATABASE_NAME: z.string().min(1).default("apthex_complaint_portal"),

  APP_BASE_URL: z.string().default("http://localhost:5173"),
  CASE_DESK_URL: z.string().optional(),
  MAIN_SITE_URL: z.string().default("http://localhost:8000"),
  CORS_ORIGINS: z.string().optional(),

  SESSION_SECRET: z.string().default("dev-session-secret-change-me-please-32chars"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  TOTP_ENCRYPTION_KEY: z.string().default("dev-totp-key-change-me-32bytes!!"),
  REQUIRE_ORIGIN: bool,
  // When false, staff login is password-only — 2FA setup and code verification
  // are skipped entirely. Default true (2FA enforced). Never disable in production.
  AUTH_REQUIRE_2FA: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  ESCALATION_DAYS: z.coerce.number().int().positive().default(7),
  SMALL_NUMBER_THRESHOLD: z.coerce.number().int().min(2).default(5),
  DUPLICATE_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  CRON_TIMEZONE: z.string().default("Asia/Kolkata"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  APTHEX_CASE_MAILBOX: z.string().optional(),
  // Generic SMTP transport (e.g. Gmail App Password). Takes priority over Resend.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  URGENT_ALERT_RECIPIENTS: z.string().optional(),
  EMAIL_DEV_LOG: bool,
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  EMAIL_OUTBOX_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CLOUDFLARE_TURNSTILE_SITE_KEY: z.string().optional(),
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),
  CAPTCHA_DEV_BYPASS: bool,

  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  MAX_VOICE_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAX_VOICE_SECONDS: z.coerce.number().int().positive().default(60),
  MAX_IMAGES: z.coerce.number().int().min(0).max(10).default(5),
  MAX_TOTAL_UPLOAD_BYTES: z.coerce.number().int().positive().default(80 * 1024 * 1024),

  RATE_LIMIT_SUBMIT_PER_IP_HOUR: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_ANON_PER_IP_HOUR: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_SUBMIT_PER_DEVICE_HOUR: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_ANON_PER_DEVICE_HOUR: z.coerce.number().int().positive().default(2),
  RATE_LIMIT_STATUS_PER_IP_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FOLLOWUP_PER_HOUR: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_LOGIN_PER_15_MIN: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_INSTITUTE_PER_MINUTE: z.coerce.number().int().positive().default(30),

  AUTO_SEED: bool,
  SEED_OWNER_EMAIL: z.string().optional(),
  SEED_OWNER_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration error:");
  for (const [field, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${errors.join(", ")}`);
  }
  throw new Error("Invalid environment configuration. See .env.example");
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

const DEFAULT_SESSION_SECRET = "dev-session-secret-change-me-please-32chars";
const DEFAULT_TOTP_KEY = "dev-totp-key-change-me-32bytes!!";

export function configWarnings() {
  const warnings = [];
  if (env.NODE_ENV !== "production") {
    if (!env.MONGODB_URI) warnings.push("MONGODB_URI is not set; an in-memory database will be used in development.");
    if (!env.RESEND_API_KEY && !(env.SMTP_USER && env.SMTP_PASS)) {
      warnings.push("No email transport configured (SMTP or RESEND_API_KEY); emails will be logged to the server console in development.");
    }
    if (!env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
      warnings.push(
        env.CAPTCHA_DEV_BYPASS
          ? "CAPTCHA development bypass is ENABLED. Never enable this in production."
          : "CAPTCHA is not configured and CAPTCHA_DEV_BYPASS is false; public submissions will be rejected."
      );
    }
    if (env.SESSION_SECRET === DEFAULT_SESSION_SECRET) warnings.push("Using the development session secret. Set SESSION_SECRET before deployment.");
    if (env.TOTP_ENCRYPTION_KEY === DEFAULT_TOTP_KEY) warnings.push("Using the development TOTP encryption key. Set TOTP_ENCRYPTION_KEY before deployment.");
    warnings.push("RETENTION_DAYS and ESCALATION_DAYS are development placeholders until the owner approves production values.");
  }
  return warnings;
}

export function assertProductionConfig() {
  if (!isProduction) return;
  const missing = [];
  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!process.env.RETENTION_DAYS) missing.push("RETENTION_DAYS (owner approval required)");
  if (!process.env.ESCALATION_DAYS) missing.push("ESCALATION_DAYS (owner approval required)");
  if (env.SESSION_SECRET.length < 32 || env.SESSION_SECRET === DEFAULT_SESSION_SECRET) missing.push("SESSION_SECRET (32+ random characters)");
  if (env.TOTP_ENCRYPTION_KEY.length < 32 || env.TOTP_ENCRYPTION_KEY === DEFAULT_TOTP_KEY) missing.push("TOTP_ENCRYPTION_KEY (32+ random characters)");
  if (!env.RESEND_API_KEY && !(env.SMTP_USER && env.SMTP_PASS)) missing.push("RESEND_API_KEY or SMTP_USER+SMTP_PASS");
  if (!env.EMAIL_FROM) missing.push("EMAIL_FROM");
  if (!env.APTHEX_CASE_MAILBOX) missing.push("APTHEX_CASE_MAILBOX");
  if (!env.CLOUDFLARE_TURNSTILE_SITE_KEY) missing.push("CLOUDFLARE_TURNSTILE_SITE_KEY");
  if (!env.CLOUDFLARE_TURNSTILE_SECRET_KEY) missing.push("CLOUDFLARE_TURNSTILE_SECRET_KEY");
  if (env.CAPTCHA_DEV_BYPASS) missing.push("CAPTCHA_DEV_BYPASS must be false in production");
  if (!env.AUTH_REQUIRE_2FA) missing.push("AUTH_REQUIRE_2FA must be true in production");
  if (env.AUTO_SEED) missing.push("AUTO_SEED must be false in production");
  if (!env.APP_BASE_URL.startsWith("https://")) missing.push("APP_BASE_URL (https)");
  if (missing.length) {
    throw new Error(`Production configuration is incomplete:\n- ${missing.join("\n- ")}`);
  }
}

export function caseDeskUrl() {
  return env.CASE_DESK_URL || `${env.APP_BASE_URL.replace(/\/$/, "")}/desk`;
}

export function statusPageUrl() {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/status`;
}

export function allowedOrigins() {
  const list = [env.APP_BASE_URL];
  if (env.CORS_ORIGINS) list.push(...env.CORS_ORIGINS.split(",").map((s) => s.trim()));
  if (env.NODE_ENV !== "production") {
    list.push("http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173");
  }
  return [...new Set(list.filter(Boolean).map((s) => s.replace(/\/$/, "")))];
}
