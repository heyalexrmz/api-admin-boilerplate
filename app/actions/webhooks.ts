"use server";

import { and, count, desc, eq, sql } from "drizzle-orm";

import { webhook, webhookEventLog } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { requireOrganizationManager } from "@/app/lib/auth";
import {
  generateWebhookSecret,
  maskSecret,
} from "@/lib/webhooks";
import { deliverWebhookEvent } from "@/lib/webhook-dispatch";
import { validateWebhookUrlForDelivery } from "@/lib/server/webhook-url-policy";
import {
  CreateWebhookFormSchema,
  UpdateWebhookFormSchema,
  type CreateWebhookState,
  type NewWebhook,
  type RotatedWebhookSecret,
  type TestEventResult,
  type UpdatedWebhook,
  type UpdateWebhookState,
  type Webhook,
  type WebhookEvent,
  type WebhookEventLog,
  type WebhookEventLogStatus,
  type WebhookStatus,
} from "@/app/lib/definitions";

type WebhookRow = typeof webhook.$inferSelect;
type EventLogRow = typeof webhookEventLog.$inferSelect;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEST_DELIVERY_COOLDOWN_MS = 30_000;
const testDeliveryAttempts = new Map<string, number>();

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function consumeTestDeliveryCooldown(input: {
  userId: string;
  organizationId: string;
  webhookId: string;
}): string | null {
  const key = `${input.userId}:${input.organizationId}:${input.webhookId}`;
  const now = Date.now();
  const lastAttempt = testDeliveryAttempts.get(key);

  if (lastAttempt && now - lastAttempt < TEST_DELIVERY_COOLDOWN_MS) {
    const seconds = Math.ceil((TEST_DELIVERY_COOLDOWN_MS - (now - lastAttempt)) / 1000);
    return `Wait ${seconds}s before sending another test event.`;
  }

  testDeliveryAttempts.set(key, now);
  return null;
}

function toWebhook(row: WebhookRow): Webhook {
  const status: WebhookStatus = row.enabled ? "active" : "disabled";
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    events: row.events as WebhookEvent[],
    enabled: row.enabled,
    secretPreview: row.secretPreview,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastFiredAt: row.lastFiredAt ? row.lastFiredAt.toISOString() : null,
    lastRotatedAt: row.lastRotatedAt ? row.lastRotatedAt.toISOString() : null,
    status,
  };
}

function toEventLog(row: EventLogRow): WebhookEventLog {
  return {
    id: row.id,
    webhookId: row.webhookId,
    eventId: row.eventId,
    eventType: row.eventType,
    status: row.status as WebhookEventLogStatus,
    httpStatus: row.httpStatus,
    attemptCount: row.attemptCount,
    latencyMs: row.latencyMs,
    payload: row.payload,
    responseHeaders: (row.responseHeaders as { name: string; value: string }[] | null) ?? null,
    responseBody: row.responseBody,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}

export async function listWebhooks(): Promise<Webhook[]> {
  const { organization } = await requireOrganizationManager();
  const rows = await db
    .select()
    .from(webhook)
    .where(eq(webhook.organizationId, organization.id))
    .orderBy(desc(webhook.createdAt));
  return rows.map(toWebhook);
}

export async function getWebhook(id: string): Promise<Webhook | null> {
  const { organization } = await requireOrganizationManager();
  if (!isValidUuid(id)) return null;
  const [row] = await db
    .select()
    .from(webhook)
    .where(and(eq(webhook.id, id), eq(webhook.organizationId, organization.id)));
  return row ? toWebhook(row) : null;
}

export async function createWebhook(
  prevState: CreateWebhookState,
  formData: FormData
): Promise<CreateWebhookState> {
  const { user, organization } = await requireOrganizationManager();

  const validated = CreateWebhookFormSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    description: formData.get("description"),
    events: formData.getAll("events"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, url, description, events } = validated.data;
  const urlError = await validateWebhookUrlForDelivery(url);
  if (urlError) return { errors: { url: [urlError] } };

  const secret = generateWebhookSecret();

  const [row] = await db
    .insert(webhook)
    .values({
      organizationId: organization.id,
      createdByUserId: user.id,
      name,
      url,
      description: description ?? null,
      events,
      enabled: true,
      secret,
      secretPreview: maskSecret(secret),
    })
    .returning();

  if (!row) {
    return { message: "Could not create the webhook. Try again." };
  }

  const created: NewWebhook = {
    id: row.id,
    name,
    url,
    description: row.description,
    events,
    enabled: row.enabled,
    secret,
    createdAt: row.createdAt.toISOString(),
    lastRotatedAt: null,
  };

  return { webhook: created };
}

export async function updateWebhook(
  prevState: UpdateWebhookState,
  formData: FormData
): Promise<UpdateWebhookState> {
  const { organization } = await requireOrganizationManager();

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "Missing webhook id." };
  if (!isValidUuid(id)) return { message: "Webhook not found." };

  const validated = UpdateWebhookFormSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    description: formData.get("description"),
    events: formData.getAll("events"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, url, description, events } = validated.data;
  const urlError = await validateWebhookUrlForDelivery(url);
  if (urlError) return { errors: { url: [urlError] } };

  const [row] = await db
    .update(webhook)
    .set({
      name,
      url,
      description: description ?? null,
      events,
      updatedAt: new Date(),
    })
    .where(and(eq(webhook.id, id), eq(webhook.organizationId, organization.id)))
    .returning({
      name: webhook.name,
      url: webhook.url,
      description: webhook.description,
      events: webhook.events,
    });

  if (!row) return { message: "Webhook not found." };

  const updated: UpdatedWebhook = {
    name: row.name,
    url: row.url,
    description: row.description,
    events: row.events as WebhookEvent[],
  };

  return { webhook: updated };
}

export async function toggleWebhook(
  id: string
): Promise<{ success: true; enabled: boolean } | { error: string }> {
  const { organization } = await requireOrganizationManager();

  if (!id) return { error: "Missing webhook id." };
  if (!isValidUuid(id)) return { error: "Webhook not found." };

  const [updated] = await db
    .update(webhook)
    .set({ enabled: sql`not ${webhook.enabled}`, updatedAt: new Date() })
    .where(and(eq(webhook.id, id), eq(webhook.organizationId, organization.id)))
    .returning({ enabled: webhook.enabled });

  if (!updated) return { error: "Could not update the webhook." };

  return { success: true, enabled: updated.enabled };
}

export async function rotateWebhookSecret(
  id: string
): Promise<{ secret: RotatedWebhookSecret } | { error: string }> {
  const { organization } = await requireOrganizationManager();

  if (!id) return { error: "Missing webhook id." };
  if (!isValidUuid(id)) return { error: "Webhook not found." };

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
    .where(and(eq(webhook.id, id), eq(webhook.organizationId, organization.id)))
    .returning({ id: webhook.id });

  if (!row) return { error: "Webhook not found." };

  return {
    secret: {
      id: row.id,
      secret,
      preview: maskSecret(secret),
      lastRotatedAt: now.toISOString(),
    },
  };
}

export async function deleteWebhook(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { organization } = await requireOrganizationManager();

  if (!id) return { error: "Missing webhook id." };
  if (!isValidUuid(id)) return { error: "Webhook not found." };

  const [row] = await db
    .delete(webhook)
    .where(and(eq(webhook.id, id), eq(webhook.organizationId, organization.id)))
    .returning({ id: webhook.id });

  if (!row) return { error: "Webhook not found." };

  return { success: true };
}

export async function listWebhookEvents(
  webhookId: string
): Promise<WebhookEventLog[]> {
  const { organization } = await requireOrganizationManager();
  if (!isValidUuid(webhookId)) return [];

  // Verify the webhook belongs to this org before listing its events.
  const [parent] = await db
    .select({ id: webhook.id })
    .from(webhook)
    .where(and(eq(webhook.id, webhookId), eq(webhook.organizationId, organization.id)));

  if (!parent) return [];

  const rows = await db
    .select()
    .from(webhookEventLog)
    .where(eq(webhookEventLog.webhookId, webhookId))
    .orderBy(desc(webhookEventLog.createdAt));
  return rows.map(toEventLog);
}

export async function countWebhookEvents(
  webhookId: string
): Promise<number> {
  const { organization } = await requireOrganizationManager();
  if (!isValidUuid(webhookId)) return 0;

  const [parent] = await db
    .select({ id: webhook.id })
    .from(webhook)
    .where(and(eq(webhook.id, webhookId), eq(webhook.organizationId, organization.id)));

  if (!parent) return 0;

  const [row] = await db
    .select({ value: count() })
    .from(webhookEventLog)
    .where(eq(webhookEventLog.webhookId, webhookId));

  return row?.value ?? 0;
}

export async function sendTestEvent(
  webhookId: string
): Promise<TestEventResult> {
  const { user, organization } = await requireOrganizationManager();

  if (!webhookId) return { error: "Missing webhook id." };
  if (!isValidUuid(webhookId)) return { error: "Webhook not found." };

  const cooldownError = consumeTestDeliveryCooldown({
    userId: user.id,
    organizationId: organization.id,
    webhookId,
  });
  if (cooldownError) return { error: cooldownError };

  const [row] = await db
    .select()
    .from(webhook)
    .where(
      and(eq(webhook.id, webhookId), eq(webhook.organizationId, organization.id))
    );

  if (!row) return { error: "Webhook not found." };
  if (!row.secret) {
    return {
      error: "Rotate the signing secret before sending a test event.",
    };
  }

  const urlError = await validateWebhookUrlForDelivery(row.url);
  if (urlError) return { error: urlError };

  const logRow = await deliverWebhookEvent(row, organization.id, "ticket.finalized", {
    webhookId: row.id,
    webhookName: row.name,
    message: "This is a test event from Acme.",
  });

  if (!logRow) return { error: "Could not record the delivery." };

  return {
    eventLog: toEventLog(logRow),
    lastFiredAt: logRow.deliveredAt?.toISOString() ?? new Date().toISOString(),
  };
}
