import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

/** 32 random bytes → 64 hex chars, prefixed for identifiability. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

/** Masked preview kept for display, e.g. `whsec_••••••••1234`. */
export function maskSecret(secret: string): string {
  return `whsec_${"•".repeat(8)}${secret.slice(-4)}`;
}

/** HMAC-SHA256 of the raw payload body, hex-encoded. Sent as the signature. */
export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Unique id for a test event, e.g. `evt_test_<uuid>`. */
export function generateEventId(): string {
  return `evt_test_${randomUUID()}`;
}

/** SHA-256 helper retained for parity with the api-keys module if needed later. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
