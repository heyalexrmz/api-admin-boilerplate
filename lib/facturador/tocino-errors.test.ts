import { afterEach, describe, expect, it, vi } from "vitest";

import { submitToTocino, type TocinoConfig } from "./tocino";

const config: TocinoConfig = {
  baseUrl: "https://provider.example",
  apiKey: "test-key",
  webhookHeader: "",
  webhookToken: "",
  webhookSecret: "",
  assetHosts: [],
};

function submit() {
  return submitToTocino({ idempotencyKey: "same-ticket", body: {}, config });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider submission errors", () => {
  it.each([35115, 1793])("recognizes the reported throttle with a %i second wait", async (seconds) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: `Request was throttled. Expected available in ${seconds} seconds.`,
    }), { status: 429 })));

    expect(await submit()).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: seconds,
      error: { code: "UPSTREAM_RATE_LIMITED", category: "quota" },
    });
  });

  it.each([
    ["120", 120],
    ["Thu, 01 Oct 2026 12:05:00 GMT", 300],
    ["Thu, 01 Oct 2026 11:00:00 GMT", 0],
    ["-10", undefined],
    ["invalid", undefined],
    ["9".repeat(400), undefined],
  ])("reads Retry-After %s without inventing a wait", async (header, seconds) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too many requests", {
      status: 429, headers: { "retry-after": header as string },
    })));
    expect(await submit()).toMatchObject({ status: 429, retryAfterSeconds: seconds });
  });

  it("keeps the longer body wait when the header is shorter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: "Request was throttled. Expected available in 35115 seconds.",
    }), { status: 429, headers: { "retry-after": "10" } })));
    expect(await submit()).toMatchObject({ retryAfterSeconds: 35115 });
  });

  it.each([
    [401, "UPSTREAM_AUTH_ERROR", "auth"],
    [403, "UPSTREAM_AUTH_ERROR", "auth"],
    [408, "UPSTREAM_UNAVAILABLE", "connection"],
    [500, "UPSTREAM_UNAVAILABLE", "upstream"],
    [503, "UPSTREAM_UNAVAILABLE", "upstream"],
    [422, "UPSTREAM_VALIDATION", "validation"],
    [404, "UPSTREAM_REJECTED", "upstream"],
    [200, "UPSTREAM_INVALID_RESPONSE", "upstream"],
  ])("classifies HTTP %i even when its response contains detail", async (status, code, category) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: "Provider diagnostic",
    }), { status })));
    expect(await submit()).toMatchObject({
      ok: false, status, error: { code, category }, raw: { detail: "Provider diagnostic" },
    });
  });

  it("classifies connection failures separately from invalid data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await submit()).toMatchObject({
      ok: false, error: { code: "UPSTREAM_UNAVAILABLE", category: "connection" },
    });
  });
});
