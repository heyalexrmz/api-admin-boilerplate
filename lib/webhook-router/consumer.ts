import { applyTocinoWebhookEvent } from "@/lib/facturador/core";
import { classifyTocinoEvent } from "@/lib/facturador/tocino";
import { validateWebhookUrlForDelivery } from "@/lib/server/webhook-url-policy";
import { getRouterConfig } from "./config";
import { ROUTER_HOP_HEADER } from "./ingress";
import { claimRouterDelivery, finishRouterDelivery, type RouterDelivery } from "./store";

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.min(86_400, Math.max(0, Math.ceil(seconds))) : undefined;
}

async function deliver(row: RouterDelivery): Promise<Parameters<typeof finishRouterDelivery>[1]> {
  if (row.destination === "local") {
    const payload = JSON.parse(row.raw_body) as Record<string, unknown>;
    if (!classifyTocinoEvent(payload)) return { ok: true }; // Forward progress events without finalizing a ticket.
    if (![payload.idempotency_key, payload.nova_request_id].some((id) => typeof id === "string" && id.trim())) {
      return { ok: false, error: "missing_request_identifier", permanent: true };
    }
    const result = await applyTocinoWebhookEvent(payload);
    return result.parked ? { ok: false, error: "ticket_not_found" } : { ok: true };
  }

  const config = getRouterConfig();
  if (!config.forwardUrls.includes(row.destination)) return { ok: false, error: "destination_removed", permanent: true };
  if (await validateWebhookUrlForDelivery(row.destination)) return { ok: false, error: "destination_unavailable" };
  const response = await fetch(row.destination, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [config.headerName]: config.token,
      "idempotency-key": row.event_id,
      "x-webhook-event-id": row.event_id,
      [ROUTER_HOP_HEADER]: "1",
    },
    body: row.raw_body,
    redirect: "manual", // Never send a callback or its credential to a redirected host.
    signal: AbortSignal.timeout(15_000),
  });
  // Do not retain potentially sensitive downstream response bodies.
  await response.body?.cancel();
  return response.ok ? { ok: true, httpStatus: response.status } : {
    ok: false,
    error: `destination_http_${response.status}`,
    httpStatus: response.status,
    retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
  };
}

export async function tickRouterDelivery(destination: "local" | "forward") {
  const row = await claimRouterDelivery(destination);
  if (!row) return false;
  let result: Parameters<typeof finishRouterDelivery>[1];
  try { result = await deliver(row); }
  catch { result = { ok: false, error: "delivery_processing_failed" }; }
  await finishRouterDelivery(row, result);
  console.log(`[webhook-router] delivery=${row.id} kind=${destination} attempt=${row.attempts} result=${result.ok ? "completed" : result.error}`);
  return true;
}
