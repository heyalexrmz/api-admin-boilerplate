import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { apiKey } from "./api-keys";

export const webhookEventStatus = pgEnum("webhook_event_status", [
  "success",
  "failed",
  "pending",
  "retrying",
]);

export const webhook = pgTable("webhook", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdByApiKeyId: uuid("created_by_api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  events: text("events").array().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  // Plaintext signing secret, used to HMAC-sign outgoing deliveries.
  // Nullable so legacy rows (created when only a hash was stored) survive the
  // migration — rotate the secret to populate it and enable test events.
  secret: text("secret"),
  secretPreview: text("secret_preview").notNull(),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEventLog = pgTable("webhook_event_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id").notNull().references(() => webhook.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  status: webhookEventStatus("status").notNull().default("pending"),
  httpStatus: integer("http_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: text("response_body"),
  attemptCount: integer("attempt_count").notNull().default(1),
  latencyMs: integer("latency_ms"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const webhookRelations = relations(webhook, ({ one, many }) => ({
  organization: one(organization, { fields: [webhook.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [webhook.createdByUserId], references: [user.id] }),
  createdByApiKey: one(apiKey, { fields: [webhook.createdByApiKeyId], references: [apiKey.id] }),
  eventLogs: many(webhookEventLog),
}));

export const webhookEventLogRelations = relations(webhookEventLog, ({ one }) => ({
  webhook: one(webhook, { fields: [webhookEventLog.webhookId], references: [webhook.id] }),
  organization: one(organization, { fields: [webhookEventLog.organizationId], references: [organization.id] }),
}));
