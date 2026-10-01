import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/facturador/core", () => ({ applyTocinoWebhookEvent: vi.fn() }));
vi.mock("@/lib/server/webhook-url-policy", () => ({ validateWebhookUrlForDelivery: vi.fn(async () => null) }));
vi.mock("./store", () => ({ claimRouterDelivery: vi.fn(), finishRouterDelivery: vi.fn(), persistRouterDeliveries: vi.fn() }));

import { applyTocinoWebhookEvent } from "@/lib/facturador/core";
import { validateWebhookUrlForDelivery } from "@/lib/server/webhook-url-policy";
import { tickRouterDelivery } from "./consumer";
import { claimRouterDelivery, finishRouterDelivery, type RouterDelivery } from "./store";
import { getRouterConfig } from "./config";

const target = "https://destination.example/webhook";
const raw = '{ "nova_request_id": "request-1", "status": "failed", "error_msg": "Ticket vencido" }';
const row: RouterDelivery = { id: "delivery-1", event_id: "event-1", raw_body: raw, destination: target, attempts: 1, max_attempts: 12, locked_by: "lease-1" };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("UPSTREAM_WEBHOOK_HEADER", "typeform-signature");
  vi.stubEnv("UPSTREAM_WEBHOOK_TOKEN", "test-only-token");
  vi.stubEnv("WEBHOOK_ROUTER_FORWARD_URLS", JSON.stringify([target]));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(claimRouterDelivery).mockResolvedValue(row);
  vi.mocked(validateWebhookUrlForDelivery).mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("router deliveries", () => {
  it("forwards exact JSON with configured authentication and a stable event identifier", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await tickRouterDelivery("forward");
    expect(fetchMock).toHaveBeenCalledWith(target, expect.objectContaining({
      method: "POST", body: raw, redirect: "manual", headers: {
        "content-type": "application/json", "typeform-signature": "test-only-token",
        "idempotency-key": "event-1", "x-webhook-event-id": "event-1", "x-webhook-router-hop": "1",
      },
    }));
    expect(finishRouterDelivery).toHaveBeenCalledWith(row, { ok: true, httpStatus: 204 });
  });
  it("retries a throttled destination with its retry-after, independently of local processing", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": "35115" } }));
    await tickRouterDelivery("forward");
    expect(finishRouterDelivery).toHaveBeenCalledWith(row, { ok: false, error: "destination_http_429", httpStatus: 429, retryAfterSeconds: 35115 });
    expect(applyTocinoWebhookEvent).not.toHaveBeenCalled();
  });
  it("does not log an exception containing a secret", async () => {
    fetchMock.mockRejectedValue(new Error("private-token-and-url"));
    await tickRouterDelivery("forward");
    expect(finishRouterDelivery).toHaveBeenCalledWith(row, { ok: false, error: "delivery_processing_failed" });
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("private-token");
  });
  it("blocks destinations resolving to private networks", async () => {
    vi.mocked(validateWebhookUrlForDelivery).mockResolvedValue("private address");
    await tickRouterDelivery("forward");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(finishRouterDelivery).toHaveBeenCalledWith(row, { ok: false, error: "destination_unavailable" });
  });
  it("stops sending to removed destinations", async () => {
    vi.stubEnv("WEBHOOK_ROUTER_FORWARD_URLS", "[]");
    await tickRouterDelivery("forward");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(finishRouterDelivery).toHaveBeenCalledWith(row, { ok: false, error: "destination_removed", permanent: true });
  });
  it("finishes the local ticket through the existing callback processor", async () => {
    const local = { ...row, destination: "local" };
    vi.mocked(claimRouterDelivery).mockResolvedValue(local);
    vi.mocked(applyTocinoWebhookEvent).mockResolvedValue({ ok: true, parked: false });
    await tickRouterDelivery("local");
    expect(applyTocinoWebhookEvent).toHaveBeenCalledWith(JSON.parse(raw));
    expect(finishRouterDelivery).toHaveBeenCalledWith(local, { ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retains early callbacks until their ticket can be found", async () => {
    const local = { ...row, destination: "local" };
    vi.mocked(claimRouterDelivery).mockResolvedValue(local);
    vi.mocked(applyTocinoWebhookEvent).mockResolvedValue({ ok: true, parked: true });
    await tickRouterDelivery("local");
    expect(finishRouterDelivery).toHaveBeenCalledWith(local, { ok: false, error: "ticket_not_found" });
  });
  it("ignores progress locally instead of creating an empty invoice", async () => {
    const local = { ...row, destination: "local", raw_body: '{"status":"processing","nova_request_id":"request-1"}' };
    vi.mocked(claimRouterDelivery).mockResolvedValue(local);
    await tickRouterDelivery("local");
    expect(applyTocinoWebhookEvent).not.toHaveBeenCalled();
    expect(finishRouterDelivery).toHaveBeenCalledWith(local, { ok: true });
  });
});

describe("router configuration", () => {
  it.each(['["http://example.com/webhook"]', '["https://127.0.0.1/webhook"]', '["https://a:b@example.com/"]', '"https://example.com/"', "invalid"])("rejects invalid destination configuration %s", (urls) => {
    expect(() => getRouterConfig({ UPSTREAM_WEBHOOK_TOKEN: "test", WEBHOOK_ROUTER_FORWARD_URLS: urls })).toThrow();
  });
  it("deduplicates destination URLs", () => {
    expect(getRouterConfig({ UPSTREAM_WEBHOOK_TOKEN: "test", WEBHOOK_ROUTER_FORWARD_URLS: JSON.stringify([target, target]) }).forwardUrls).toEqual([target]);
  });
});
