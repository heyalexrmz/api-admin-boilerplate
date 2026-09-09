import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/facturador/core", () => ({
  enqueueTocinoWebhookEvent: vi.fn(async () => ({ ok: true, queued: true })),
}));
vi.mock("@/lib/request-logging", () => ({
  clientIp: () => "127.0.0.1",
  persistRequestLog: vi.fn(async () => {}),
  safeRequestHeaders: () => [],
  safeResponseHeaders: () => [],
}));

import { POST } from "../app/api/v1/webhooks/upstream/route";
import { enqueueTocinoWebhookEvent } from "@/lib/facturador/core";
import { ApiError } from "./api-contracts";

describe("upstream webhook without authentication headers", () => {
  beforeEach(() => vi.clearAllMocks());

  function request(body: string) {
    return new NextRequest("https://taxotimbre.com/api/v1/webhooks/upstream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  }

  it("queues a valid event without a token or signature", async () => {
    const payload = { nova_request_id: "request-1", status: "finalized" };
    const response = await POST(request(JSON.stringify(payload)));
    expect(response.status).toBe(200);
    expect(enqueueTocinoWebhookEvent).toHaveBeenCalledWith(payload);
  });

  it("rejects malformed JSON before queuing", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_json");
    expect(enqueueTocinoWebhookEvent).not.toHaveBeenCalled();
  });

  it("preserves payload validation errors from the event handler", async () => {
    vi.mocked(enqueueTocinoWebhookEvent).mockRejectedValueOnce(new ApiError({
      status: 400,
      code: "invalid_payload",
      type: "validation_error",
      message: "Missing idempotency_key or nova_request_id.",
    }));
    const response = await POST(request("{}"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_payload");
  });
});
