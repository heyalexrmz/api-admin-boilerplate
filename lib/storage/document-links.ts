import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 15 * 60;

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function signingSecret(): string {
  const secret = optionalEnv("DOCUMENT_SIGNING_SECRET") ?? optionalEnv("BETTER_AUTH_SECRET");
  if (!secret) {
    throw new Error("Missing DOCUMENT_SIGNING_SECRET or BETTER_AUTH_SECRET");
  }
  return secret;
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function sign(documentId: string, expiresAt: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${documentId}.${expiresAt}`)
    .digest("hex");
}

export function createSignedDocumentUrl(
  documentId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = sign(documentId, expiresAt);
  const params = new URLSearchParams({
    exp: String(expiresAt),
    sig: signature,
  });
  return `${baseUrl()}/api/v1/documents/${documentId}/download?${params}`;
}

export function verifySignedDocumentUrl(input: {
  documentId: string;
  expiresAt: number;
  signature: string;
}): boolean {
  if (!Number.isFinite(input.expiresAt)) return false;
  if (input.expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(input.documentId, input.expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.signature, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
