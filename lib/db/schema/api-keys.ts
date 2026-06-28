import { relations } from "drizzle-orm";
import { text, timestamp, uuid, pgTable } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const apiKey = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hash: text("hash").notNull(),
  preview: text("preview").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  organization: one(organization, { fields: [apiKey.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [apiKey.createdByUserId], references: [user.id] }),
}));
