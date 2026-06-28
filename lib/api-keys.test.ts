import { describe, it, expect } from "vitest";

import {
  computeExpiry,
  generateApiKeySecret,
  hashSecret,
  maskSecret,
} from "./api-keys";

describe("generateApiKeySecret", () => {
  it("produces sk_live_ followed by 48 hex chars", () => {
    expect(generateApiKeySecret()).toMatch(/^sk_live_[0-9a-f]{48}$/);
  });

  it("is unique across calls", () => {
    expect(generateApiKeySecret()).not.toBe(generateApiKeySecret());
  });
});

describe("hashSecret", () => {
  it("is a stable 64-char sha256 hex", () => {
    expect(hashSecret("sk_live_abc")).toBe(hashSecret("sk_live_abc"));
    expect(hashSecret("sk_live_abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs per input", () => {
    expect(hashSecret("a")).not.toBe(hashSecret("b"));
  });
});

describe("maskSecret", () => {
  it("masks everything but the last 4 characters", () => {
    expect(maskSecret("sk_live_1234567890abcd")).toBe("sk_live_••••••••abcd");
  });

  it("always shows the sk_live_ prefix", () => {
    expect(maskSecret("sk_live_xyzw").startsWith("sk_live_")).toBe(true);
  });
});

describe("computeExpiry", () => {
  it("returns null for 'never'", () => {
    expect(computeExpiry("never", 0)).toBeNull();
  });

  it.each([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
    ["365d", 365],
  ] as const)("adds %s as %i days", (expiry, days) => {
    expect(computeExpiry(expiry, 0)?.getTime()).toBe(days * 24 * 60 * 60 * 1000);
  });
});
