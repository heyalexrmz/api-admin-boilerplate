import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { session, user } from "./auth";

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const oauthClient = pgTable("oauth_client", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: boolean("disabled").default(false),
  skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"),
  subjectType: text("subject_type"),
  scopes: text("scopes").array(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts").array(),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris").array().notNull(),
  postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  grantTypes: text("grant_types").array(),
  responseTypes: text("response_types").array(),
  public: boolean("public"),
  type: text("type"),
  requirePKCE: boolean("require_pkce"),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata"),
}, (table) => [index("oauth_client_user_idx").on(table.userId)]);

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  revoked: timestamp("revoked", { withTimezone: true }),
  authTime: timestamp("auth_time", { withTimezone: true }),
  scopes: text("scopes").array().notNull(),
}, (table) => [
  index("oauth_refresh_client_idx").on(table.clientId),
  index("oauth_refresh_session_idx").on(table.sessionId),
  index("oauth_refresh_user_idx").on(table.userId),
]);

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  scopes: text("scopes").array().notNull(),
}, (table) => [
  index("oauth_access_client_idx").on(table.clientId),
  index("oauth_access_session_idx").on(table.sessionId),
  index("oauth_access_user_idx").on(table.userId),
  index("oauth_access_refresh_idx").on(table.refreshId),
]);

export const oauthConsent = pgTable("oauth_consent", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("oauth_consent_client_idx").on(table.clientId),
  index("oauth_consent_user_idx").on(table.userId),
]);
