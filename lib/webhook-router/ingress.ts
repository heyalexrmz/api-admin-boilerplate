import { createHash, timingSafeEqual } from "node:crypto";
import { getRouterConfig, type RouterConfig } from "./config";
import { persistRouterDeliveries } from "./store";

export const ROUTER_PATH = "/api/v1/webhooks/upstream";
export const MAX_WEBHOOK_BYTES = 1024 * 1024;
export const ROUTER_HOP_HEADER = "x-webhook-router-hop";

// JSON key order/whitespace must not turn an upstream redelivery into a new event.
export function webhookEventId(payload: unknown): string {
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
    return JSON.stringify(value);
  }
  return `evt_${createHash("sha256").update(canonical(payload)).digest("hex")}`;
}

function authorized(headers: Headers, config: RouterConfig): boolean {
  const actual = Buffer.from(headers.get(config.headerName) ?? "");
  const expected = Buffer.from(config.token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function acceptRouterWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  let config: RouterConfig;
  try { config = getRouterConfig(); }
  catch { return Response.json({ error: "router_not_configured" }, { status: 503 }); }
  if (!authorized(request.headers, config)) return Response.json({ error: "invalid_signature" }, { status: 401 });
  // Prevent a configured destination from sending a routed copy around a loop.
  if (request.headers.has(ROUTER_HOP_HEADER)) return Response.json({ error: "routing_loop" }, { status: 409 });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) {
      await reader?.cancel();
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    }
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return Response.json({ error: "payload_too_large" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch { return Response.json({ error: "invalid_body" }, { status: 400 }); }

  let payload: unknown;
  let rawBody: string;
  let eventId: string;
  try {
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    payload = JSON.parse(rawBody);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    eventId = webhookEventId(payload);
  } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }

  // Unknown local identifiers still need forwarding to the other applications.
  const currentUrl = new URL(request.url);
  if (config.forwardUrls.some((url) => new URL(url).origin === currentUrl.origin && new URL(url).pathname === currentUrl.pathname)) {
    return Response.json({ error: "routing_loop" }, { status: 503 });
  }
  try {
    const created = await persistRouterDeliveries({ eventId, rawBody, destinations: ["local", ...config.forwardUrls] });
    return Response.json({ ok: true, event_id: eventId, queued: true, duplicate: created === 0 }, { status: 202 });
  } catch {
    // No ACK until every destination has been durably recorded in one statement.
    console.error("[webhook-router] callback could not be persisted");
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "retry-after": "30" } });
  }
}
