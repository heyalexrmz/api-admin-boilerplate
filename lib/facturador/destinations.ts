import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { FACTURADOR_WEBHOOK_EVENTS } from "@/lib/api-contracts";
import { db } from "@/lib/db";
import { webhook, webhookEventLog } from "@/lib/db/schema";
import { validateWebhookUrlForDelivery } from "@/lib/server/webhook-url-policy";
import { generateWebhookSecret, maskSecret } from "@/lib/webhooks";
import { deliverWebhookEvent } from "@/lib/webhook-dispatch";

export const DestinationCreateSchema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url(),
  description: z.string().max(240).optional().nullable(),
  events: z.array(z.enum(FACTURADOR_WEBHOOK_EVENTS)).min(1).optional(),
  secret: z.string().min(16).optional(),
});

export const DestinationUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  url: z.string().url().optional(),
  description: z.string().max(240).optional().nullable(),
  events: z.array(z.enum(FACTURADOR_WEBHOOK_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
});

type DestinationRow = typeof webhook.$inferSelect;

export function toDestination(row: DestinationRow) {
  return {
    object: "destination",
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    events: row.events,
    active: row.enabled,
    has_secret: Boolean(row.secret),
    secret_preview: row.secretPreview,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    last_fired_at: row.lastFiredAt?.toISOString() ?? null,
  };
}

export async function listDestinations(organizationId: string) {
  const rows = await db
    .select()
    .from(webhook)
    .where(eq(webhook.organizationId, organizationId))
    .orderBy(desc(webhook.createdAt));
  return rows.map(toDestination);
}

export async function createDestination(input: {
  organizationId: string;
  apiKeyId: string;
  body: z.infer<typeof DestinationCreateSchema>;
}) {
  const urlError = await validateWebhookUrlForDelivery(input.body.url);
  if (urlError) throw new Error(urlError);

  const secret = input.body.secret ?? generateWebhookSecret();
  const [row] = await db
    .insert(webhook)
    .values({
      organizationId: input.organizationId,
      createdByApiKeyId: input.apiKeyId,
      name: input.body.name,
      url: input.body.url,
      description: input.body.description ?? null,
      events: input.body.events ?? ["ticket.finalized", "ticket.failed"],
      enabled: true,
      secret,
      secretPreview: maskSecret(secret),
    })
    .returning();

  if (!row) throw new Error("Could not create destination.");
  return { destination: toDestination(row), secret };
}

export async function getDestination(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(webhook)
    .where(and(eq(webhook.organizationId, organizationId), eq(webhook.id, id)));
  return row ? toDestination(row) : null;
}

export async function updateDestination(input: {
  organizationId: string;
  id: string;
  body: z.infer<typeof DestinationUpdateSchema>;
}) {
  if (input.body.url) {
    const urlError = await validateWebhookUrlForDelivery(input.body.url);
    if (urlError) throw new Error(urlError);
  }

  const [row] = await db
    .update(webhook)
    .set({
      name: input.body.name,
      url: input.body.url,
      description: input.body.description,
      events: input.body.events,
      enabled: input.body.active,
      updatedAt: new Date(),
    })
    .where(and(eq(webhook.organizationId, input.organizationId), eq(webhook.id, input.id)))
    .returning();

  return row ? toDestination(row) : null;
}

export async function deleteDestination(organizationId: string, id: string) {
  const [row] = await db
    .update(webhook)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(webhook.organizationId, organizationId), eq(webhook.id, id)))
    .returning();
  return row ? toDestination(row) : null;
}

export async function rotateDestinationSecret(organizationId: string, id: string) {
  const secret = generateWebhookSecret();
  const now = new Date();
  const [row] = await db
    .update(webhook)
    .set({
      secret,
      secretPreview: maskSecret(secret),
      lastRotatedAt: now,
      updatedAt: now,
    })
    .where(and(eq(webhook.organizationId, organizationId), eq(webhook.id, id)))
    .returning();
  return row ? { destination: toDestination(row), secret } : null;
}

export async function listDestinationDeliveries(organizationId: string, id: string) {
  const rows = await db
    .select()
    .from(webhookEventLog)
    .where(
      and(
        eq(webhookEventLog.organizationId, organizationId),
        eq(webhookEventLog.webhookId, id)
      )
    )
    .orderBy(desc(webhookEventLog.createdAt));

  return rows.map((row) => ({
    object: "delivery",
    id: row.id,
    event_id: row.eventId,
    event_type: row.eventType,
    status: row.status,
    http_status: row.httpStatus,
    attempts: row.attemptCount,
    latency_ms: row.latencyMs,
    payload: row.payload,
    response_body: row.responseBody,
    created_at: row.createdAt.toISOString(),
    delivered_at: row.deliveredAt?.toISOString() ?? null,
  }));
}

export async function sendDestinationTestEvent(input: {
  organizationId: string;
  id: string;
  livemode: boolean;
  requestId: string;
}) {
  const [row] = await db
    .select()
    .from(webhook)
    .where(and(eq(webhook.organizationId, input.organizationId), eq(webhook.id, input.id)));
  if (!row) return null;

  return deliverWebhookEvent(
    row,
    input.organizationId,
    "ticket.finalized",
    {
      object: "ticket",
      id: "ticket_test",
      status: "finalized",
      invoice: null,
      documents: [],
      test: true,
    },
    { id: input.requestId, livemode: input.livemode }
  );
}
