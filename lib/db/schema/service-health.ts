import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** One row per worker process; refreshed on every poll so liveness can be measured. */
export const workerHeartbeat = pgTable("worker_heartbeat", {
  workerId: text("worker_id").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Last published availability per mode. Webhooks for service.* fire only when
 * a process wins the conditional update that changes `status`.
 */
export const serviceStatus = pgTable("service_status", {
  mode: text("mode", { enum: ["live", "test"] }).primaryKey(),
  status: text("status", { enum: ["operational", "degraded", "down"] }).notNull(),
  components: text("components").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Operator-set availability for a component, e.g. to declare an incident or to
 * switch extraction off in the sandbox. It can only worsen the measured status.
 */
export const serviceOverride = pgTable(
  "service_override",
  {
    mode: text("mode", { enum: ["live", "test"] }).notNull(),
    component: text("component", { enum: ["ingest", "extraction", "invoicing"] }).notNull(),
    status: text("status", { enum: ["degraded", "down"] }).notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mode, table.component] }),
  })
);
