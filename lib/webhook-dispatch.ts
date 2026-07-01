import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { WebhookEvent, WebhookEventLogStatus } from "@/app/lib/definitions";
import { API_VERSION, type FacturadorWebhookEvent, type EventEnvelope } from "@/lib/api-contracts";
import { db } from "@/lib/db";
import { webhook, webhookEventLog } from "@/lib/db/schema";
import { validateWebhookUrlForDelivery } from "@/lib/server/webhook-url-policy";
import { signPayload } from "@/lib/webhooks";

const DELIVERY_TIMEOUT_MS = 10_000;
const SAFE_RESPONSE_HEADERS = new Set(["content-length", "content-type"]);

type WebhookRow = typeof webhook.$inferSelect;

function createEventId(eventType: string): string {
  const slug = eventType.replace(/\./g, "_");
  return `evt_${slug}_${randomUUID()}`;
}

function serializeSafeResponseHeaders(headers: Headers) {
  return Array.from(headers.entries()).map(([name, value]) => ({
    name,
    value: SAFE_RESPONSE_HEADERS.has(name.toLowerCase()) ? value : "[redacted]",
  }));
}

/** POST a signed payload to one webhook endpoint and persist the delivery log. */
export async function deliverWebhookEvent(
  row: WebhookRow,
  organizationId: string,
  eventType: FacturadorWebhookEvent,
  data: Record<string, unknown>,
  request?: { id?: string | null; idempotencyKey?: string | null; livemode?: boolean }
): Promise<typeof webhookEventLog.$inferSelect | null> {
  const eventId = createEventId(eventType);
  const createdAt = new Date();
  const payload: EventEnvelope<Record<string, unknown>> = {
    id: eventId,
    object: "event",
    api_version: API_VERSION,
    type: eventType,
    created: createdAt.toISOString(),
    livemode: request?.livemode ?? true,
    data: { object: data },
    request: {
      id: request?.id ?? null,
      idempotency_key: request?.idempotencyKey ?? null,
    },
  };

  if (!row.secret) {
    const deliveredAt = new Date();
    const [logRow] = await db
      .insert(webhookEventLog)
      .values({
        webhookId: row.id,
        organizationId,
        eventId,
        eventType,
        status: "failed",
        httpStatus: null,
        responseHeaders: null,
        responseBody:
          "Webhook has no signing secret — rotate the secret to enable delivery.",
        attemptCount: 1,
        latencyMs: null,
        payload,
        deliveredAt,
      })
      .returning();

    await db
      .update(webhook)
      .set({ lastFiredAt: deliveredAt, updatedAt: deliveredAt })
      .where(eq(webhook.id, row.id));

    return logRow ?? null;
  }

  const body = JSON.stringify(payload);
  const signature = signPayload(row.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  const startedAt = Date.now();
  let status: WebhookEventLogStatus = "failed";
  let httpStatus: number | null = null;
  let responseHeaders: { name: string; value: string }[] | null = null;
  let responseBody: string | null = null;

  try {
    const urlError = await validateWebhookUrlForDelivery(row.url);
    if (urlError) throw new Error(urlError);

    const res = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Id": row.id,
        "X-Webhook-Event": eventType,
        "X-Webhook-Timestamp": Math.floor(createdAt.getTime() / 1000).toString(),
        "X-Webhook-Signature": `sha256=${signature}`,
        "User-Agent": "TaxoTimbre-Webhook/1.0",
      },
      body,
      redirect: "error",
      signal: controller.signal,
    });
    httpStatus = res.status;
    responseHeaders = serializeSafeResponseHeaders(res.headers);
    responseBody = null;
    status = res.ok ? "success" : "failed";
  } catch (error) {
    status = "failed";
    responseBody =
      error instanceof Error
        ? `Delivery error: ${error.message}`
        : "Delivery failed.";
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - startedAt;
  const deliveredAt = new Date();

  const [logRow] = await db
    .insert(webhookEventLog)
    .values({
      webhookId: row.id,
      organizationId,
      eventId,
      eventType,
      status,
      httpStatus,
      responseHeaders,
      responseBody,
      attemptCount: 1,
      latencyMs,
      payload,
      deliveredAt,
    })
    .returning();

  await db
    .update(webhook)
    .set({ lastFiredAt: deliveredAt, updatedAt: deliveredAt })
    .where(eq(webhook.id, row.id));

  return logRow ?? null;
}

/** Deliver an event to every enabled webhook in the org that subscribes to it. */
export async function dispatchOrganizationWebhookEvent(
  organizationId: string,
  eventType: WebhookEvent,
  data: Record<string, unknown>,
  request?: { id?: string | null; idempotencyKey?: string | null; livemode?: boolean }
): Promise<void> {
  const rows = await db
    .select()
    .from(webhook)
    .where(
      and(
        eq(webhook.organizationId, organizationId),
        eq(webhook.enabled, true)
      )
    );

  const subscribers = rows.filter((row) =>
    (row.events as WebhookEvent[]).includes(eventType)
  );

  if (subscribers.length === 0) return;

  await Promise.allSettled(
    subscribers.map((row) =>
      deliverWebhookEvent(
        row,
        organizationId,
        eventType as FacturadorWebhookEvent,
        data,
        request
      )
    )
  );
}
