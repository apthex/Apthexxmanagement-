/**
 * Server-side environment access.
 *
 * Production-critical secrets are validated lazily. Tests can exercise pure
 * modules without a full production environment; anything that actually uses
 * secrets calls the getters below.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get appUrl(): string {
    return optional("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get encryptionKey(): string {
    return optional("ENCRYPTION_KEY", "Cof7x9+BrijMggPavyjrOZKgBtkyhGYdLjwhMlV+eXs=");
  },
  get tokenPepper(): string {
    return optional("TOKEN_PEPPER", "JT7eTy7E/uNHj22hr/gQjo+iOPTYHPHNab51uEfl3Qc=");
  },
  get totpRequired(): boolean {
    return optional("TOTP_REQUIRED", "false") === "true";
  },
  get totpIssuer(): string {
    return optional("TOTP_ISSUER", "Apthex Internal");
  },
  get accessGateEnabled(): boolean {
    return optional("ACCESS_GATE_ENABLED", "false") === "true";
  },
  get cfAccessTeamDomain(): string {
    return optional("CF_ACCESS_TEAM_DOMAIN");
  },
  get cfAccessAud(): string {
    return optional("CF_ACCESS_AUD");
  },
  get resendApiKey(): string {
    return optional("RESEND_API_KEY");
  },
  get emailFrom(): string {
    return optional("EMAIL_FROM", "Apthex Internal <no-reply@apthex.com>");
  },
  get ownerAlertEmails(): string[] {
    return optional("OWNER_ALERT_EMAILS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  },
  get matomoUrl(): string {
    return optional("MATOMO_URL").replace(/\/$/, "");
  },
  get matomoToken(): string {
    return optional("MATOMO_TOKEN");
  },
  get matomoSiteId(): string {
    return optional("MATOMO_SITE_ID");
  },
  get cronSecret(): string {
    return optional("CRON_SECRET");
  },
  get devShowSetupLinks(): boolean {
    return !this.isProduction && optional("DEV_SHOW_SETUP_LINKS", "true") === "true";
  },
  get mongodbUri(): string {
    return optional("MONGODB_URI");
  },
} as const;

export const SESSION_COOKIE = "__Host-apt_session";
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
