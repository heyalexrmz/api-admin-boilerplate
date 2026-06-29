import { createHash, randomBytes } from "node:crypto";

export type ApiKeyExpiry = "7d" | "30d" | "90d" | "365d" | "never";
export type ApiKeyMode = "live" | "test";

const EXPIRY_DAYS: Record<ApiKeyExpiry, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  never: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 24 random bytes → 48 hex chars, prefixed for identifiability. */
export function generateApiKeySecret(mode: ApiKeyMode = "live"): string {
  return `sk_${mode}_${randomBytes(24).toString("hex")}`;
}

/** SHA-256 of the plaintext secret. Only the hash is persisted. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Masked preview kept for display, e.g. `sk_live_••••••••1234`. */
export function maskSecret(secret: string): string {
  const prefix = secret.startsWith("sk_test_") ? "sk_test_" : "sk_live_";
  return `${prefix}${"•".repeat(8)}${secret.slice(-4)}`;
}

/** Expiry Date for a key, or null when it never expires. */
export function computeExpiry(expiry: ApiKeyExpiry, now: number = Date.now()): Date | null {
  const days = EXPIRY_DAYS[expiry];
  if (days === null) return null;
  return new Date(now + days * DAY_MS);
}
