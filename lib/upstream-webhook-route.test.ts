import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/webhook-router/store", () => ({ persistRouterDeliveries: vi.fn(async () => 2) }));
vi.mock("@/lib/request-logging", () => ({
  clientIp: () => "127.0.0.1", persistRequestLog: vi.fn(async () => {}),
  safeRequestHeaders: () => [], safeResponseHeaders: () => [],
}));

import { POST } from "../app/api/v1/webhooks/upstream/route";
import { persistRouterDeliveries } from "./webhook-router/store";
import { MAX_WEBHOOK_BYTES, webhookEventId } from "./webhook-router/ingress";

const target = "https://destination.example/webhook";
const token = "test-only-shared-token";
function request(body: string, overrides?: Record<string, string>) {
  return new NextRequest("https://router.example/api/v1/webhooks/upstream", {
    method: "POST", headers: { "content-type": "application/json", "typeform-signature": token, ...overrides }, body,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("UPSTREAM_WEBHOOK_HEADER", "typeform-signature");
  vi.stubEnv("UPSTREAM_WEBHOOK_TOKEN", token);
  vi.stubEnv("WEBHOOK_ROUTER_FORWARD_URLS", JSON.stringify([target]));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("authenticated durable webhook routing", () => {
  it("persists exact raw JSON for local processing and forwarding before acknowledging", async () => {
    const body = '{ "nova_request_id": "request-1", "status": "finalized" }';
    const response = await POST(request(body));
    expect(response.status).toBe(202);
    expect(persistRouterDeliveries).toHaveBeenCalledWith({ eventId: expect.stringMatching(/^evt_/), rawBody: body, destinations: ["local", target] });
    expect(await response.json()).toMatchObject({ ok: true, queued: true, duplicate: false });
  });
  it.each(["", "incorrect"])("rejects missing or incorrect authentication (%s)", async (signature) => {
    expect((await POST(request("{}", { "typeform-signature": signature }))).status).toBe(401);
    expect(persistRouterDeliveries).not.toHaveBeenCalled();
  });
  it("fails closed when the token is absent", async () => {
    vi.stubEnv("UPSTREAM_WEBHOOK_TOKEN", "");
    expect((await POST(request("{}"))).status).toBe(503);
    expect(persistRouterDeliveries).not.toHaveBeenCalled();
  });
  it.each(["{", "null", "[]", '"text"'])("rejects an invalid JSON object (%s)", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(persistRouterDeliveries).not.toHaveBeenCalled();
  });
  it("limits streamed bodies even without content-length", async () => {
    expect((await POST(request(JSON.stringify({ data: "a".repeat(MAX_WEBHOOK_BYTES) })))).status).toBe(413);
    expect(persistRouterDeliveries).not.toHaveBeenCalled();
  });
  it("accepts events belonging to other applications for forwarding", async () => {
    expect((await POST(request('{"foreign_id":"external-1"}'))).status).toBe(202);
  });
  it("does not acknowledge a failed durable write", async () => {
    vi.mocked(persistRouterDeliveries).mockRejectedValueOnce(new Error("db unavailable"));
    const response = await POST(request("{}"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.text()).not.toContain("db unavailable");
  });
  it("acknowledges duplicate callbacks", async () => {
    vi.mocked(persistRouterDeliveries).mockResolvedValueOnce(0);
    expect(await (await POST(request("{}"))).json()).toMatchObject({ duplicate: true });
  });
  it("blocks forwarding loops", async () => {
    expect((await POST(request("{}", { "x-webhook-router-hop": "1" }))).status).toBe(409);
    vi.stubEnv("WEBHOOK_ROUTER_FORWARD_URLS", '["https://router.example/api/v1/webhooks/upstream"]');
    expect((await POST(request("{}"))).status).toBe(503);
    expect(persistRouterDeliveries).not.toHaveBeenCalled();
  });
  it("deduplicates JSON whitespace/key ordering but preserves distinct state changes", () => {
    expect(webhookEventId({ id: "1", nested: { a: 1, b: [1, 2] } })).toBe(webhookEventId({ nested: { b: [1, 2], a: 1 }, id: "1" }));
    expect(webhookEventId({ id: "1", status: "pending" })).not.toBe(webhookEventId({ id: "1", status: "finalized" }));
  });
});
