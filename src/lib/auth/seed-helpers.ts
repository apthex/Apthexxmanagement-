import { encryptSecret, randomToken, tokenHash } from "@/lib/crypto";
import { generateRecoveryCodes, normaliseRecoveryCode } from "@/lib/auth/totp";
import { env } from "@/lib/env";

export { currentStep } from "@/lib/auth/totp";

export function encryptTotpSecretForSeed(secret: string): string {
  return encryptSecret(secret, env.encryptionKey);
}

export async function seedRecoveryHashes(): Promise<{ hashes: string[]; codes: string[] }> {
  const codes = generateRecoveryCodes(10);
  const hashes = codes.map((code) => tokenHash(normaliseRecoveryCode(code), env.tokenPepper));
  return { hashes, codes };
}

export function seedTokenHash(value = randomToken(24)): string {
  return tokenHash(value, env.tokenPepper);
}
