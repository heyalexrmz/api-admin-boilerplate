import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { jobStatus } from "./facturador";

// Each destination has an independent durable delivery, including local processing.
// Authentication headers are deliberately not stored with the callback body.
export const upstreamWebhookDelivery = pgTable("upstream_webhook_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull(),
  destination: text("destination").notNull(), // "local" or a configured HTTPS URL
  rawBody: text("raw_body").notNull(),
  status: jobStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(12),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
  httpStatus: integer("http_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("upstream_webhook_delivery_event_destination_uidx").on(table.eventId, table.destination),
  index("upstream_webhook_delivery_queue_idx").on(table.status, table.runAt),
]);
