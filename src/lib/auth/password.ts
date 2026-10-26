import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/** OWASP-recommended Argon2id parameters from the build spec (m=19456, t=2, p=1, Argon2id=2). */
export const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A compact common-password list. This is intentionally checked in addition to
 * the 12-character minimum; no composition rules are imposed.
 */
const COMMON_PASSWORDS = new Set(
  `
123456789012 password1234 passwordpassword qwertyuiop12 qwerty123456 1234567890ab
letmein12345 welcome12345 admin12345678 administrator iloveyou1234 monkey123456
dragon123456 football1234 baseball1234 superman1234 princess1234 sunshine1234
trustno1trust abc123456789 password123! password12345 qwerty12345678 1q2w3e4r5t6y
apthex123456 apthexapthex apthexinternal internal1234 changeme1234 password123456
qwertyuiopas zxcvbnm12345 12345678abcd 87654321abcd india1234567 maharashtra1
devendra1234 pranav12345 shubham12345 apthex2026 apthex@2026 company12345
`.trim().split(/\s+/),
);

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Choose something less predictable.";
  }
  if (/^(.)\1{11,}$/.test(password)) return "That password is too repetitive.";
  return null;
}

export async function validateNewPassword(password: string, email?: string): Promise<string | null> {
  const problem = passwordProblem(password);
  if (problem) return problem;
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
      return "Password must not contain your email address.";
    }
  }
  return null;
}
