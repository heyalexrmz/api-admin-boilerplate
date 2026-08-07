import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSignedDocumentUrl,
  verifySignedDocumentUrl,
  WEBHOOK_DOCUMENT_TTL_SECONDS,
} from "./storage/document-links";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("signed document links", () => {
  it("creates a complete 64-character signature that verifies", () => {
    vi.stubEnv("DOCUMENT_SIGNING_SECRET", "test-document-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://taxotimbre.com/");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T21:40:04.000Z"));

    const url = new URL(createSignedDocumentUrl("document_123"));
    const expiresAt = Number(url.searchParams.get("exp"));
    const signature = url.searchParams.get("sig") ?? "";

    expect(url.origin).toBe("https://taxotimbre.com");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifySignedDocumentUrl({
        documentId: "document_123",
        expiresAt,
        signature,
      })
    ).toBe(true);
  });

  it("rejects a truncated signature", () => {
    vi.stubEnv("DOCUMENT_SIGNING_SECRET", "test-document-secret");
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const signature = new URL(
      createSignedDocumentUrl("document_123", 60)
    ).searchParams.get("sig")!;

    expect(
      verifySignedDocumentUrl({
        documentId: "document_123",
        expiresAt,
        signature: signature.slice(0, -1),
      })
    ).toBe(false);
  });

  it("supports the seven-day lifetime used by webhook document links", () => {
    vi.stubEnv("DOCUMENT_SIGNING_SECRET", "test-document-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T21:40:04.000Z"));

    const url = new URL(
      createSignedDocumentUrl("document_123", WEBHOOK_DOCUMENT_TTL_SECONDS)
    );
    const expiresAt = Number(url.searchParams.get("exp"));

    expect(expiresAt - Math.floor(Date.now() / 1000)).toBe(7 * 24 * 60 * 60);
  });
});
