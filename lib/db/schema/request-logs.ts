import { relations } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { apiKey } from "./api-keys";

export const httpMethod = pgEnum("http_method", ["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const requestLog = pgTable("request_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
  requestId: text("request_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  method: httpMethod("method").notNull(),
  path: text("path").notNull(),
  status: integer("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent").notNull(),
  requestHeaders: jsonb("request_headers").notNull(),
  requestBody: text("request_body"),
  responseHeaders: jsonb("response_headers").notNull(),
  responseBody: text("response_body"),
});

export const requestLogRelations = relations(requestLog, ({ one }) => ({
  organization: one(organization, { fields: [requestLog.organizationId], references: [organization.id] }),
  apiKey: one(apiKey, { fields: [requestLog.apiKeyId], references: [apiKey.id] }),
}));
