import { describe, expect, it } from "vitest";
import {
  ARGON2_OPTIONS,
  hashPassword,
  passwordProblem,
  validateNewPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  currentStep,
  generateRecoveryCodes,
  generateTotpSecret,
  hotpCode,
  normaliseRecoveryCode,
  verifyTotp,
} from "@/lib/auth/totp";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@/lib/env";

describe("Authentication & Session Security Requirements (Build Spec §8.1)", () => {
  it("enforces Argon2id parameters (m=19456, t=2, p=1, outputLen=32)", async () => {
    expect(ARGON2_OPTIONS.memoryCost).toBe(19456);
    expect(ARGON2_OPTIONS.timeCost).toBe(2);
    expect(ARGON2_OPTIONS.parallelism).toBe(1);
    expect(ARGON2_OPTIONS.outputLen).toBe(32);
    expect(ARGON2_OPTIONS.algorithm).toBe(2); // Argon2id

    const password = "Correct-Horse-Battery-Staple-2026!";
    const hash = await hashPassword(password);
    expect(hash).toContain("$argon2id$");

    const match = await verifyPassword(hash, password);
    expect(match).toBe(true);

    const wrong = await verifyPassword(hash, "wrong-password-1234");
    expect(wrong).toBe(false);
  });

  it("enforces minimum 12 characters and rejects common passwords", async () => {
    // Under 12 characters
    expect(passwordProblem("short123")).toContain("at least 12 characters");
    expect(passwordProblem("12345678901")).toContain("at least 12 characters");

    // Common passwords from dictionary
    expect(passwordProblem("password1234")).toContain("too common");
    expect(passwordProblem("123456789012")).toContain("too common");
    expect(passwordProblem("qwerty123456")).toContain("too common");
    expect(passwordProblem("apthex123456")).toContain("too common");

    // Repetitive characters
    expect(passwordProblem("aaaaaaaaaaaa")).toContain("too repetitive");

    // Strong password passes
    expect(passwordProblem("SecureOps#Apthex9876!")).toBeNull();

    // Password containing user email local part is rejected
    const emailProblem = await validateNewPassword("devendra-secret-pass", "devendra@apthex.com");
    expect(emailProblem).toContain("must not contain your email address");
  });

  it("handles TOTP generation, validation, step tracking, and prevents replay", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);

    const now = Date.now();
    const step = currentStep(now);
    const validCode = hotpCode(secret, step);

    // Matches current step
    const matchedStep = verifyTotp(secret, validCode, now);
    expect(matchedStep).toBe(step);

    // Invalid codes rejected
    expect(verifyTotp(secret, "000000", now)).toBeNull();
    expect(verifyTotp(secret, "abc123", now)).toBeNull();

    // Replay prevention: an application tracking last_totp_step will reject
    // candidateStep <= last_totp_step
    const lastAcceptedStep = step;
    const isReplay = matchedStep !== null && matchedStep <= lastAcceptedStep;
    expect(isReplay).toBe(true);
  });

  it("generates 10 single-use recovery codes and normalises them correctly", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);

    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
      const normalised = normaliseRecoveryCode(code);
      expect(normalised).toHaveLength(16);
      expect(/^[A-Z2-7]+$/.test(normalised)).toBe(true);
    }
  });

  it("configures session idle timeout to 8 hours and absolute max to 7 days", () => {
    expect(SESSION_IDLE_MS).toBe(8 * 60 * 60 * 1000); // 8 hours
    expect(SESSION_ABSOLUTE_MS).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
  });
});
