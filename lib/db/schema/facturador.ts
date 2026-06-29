import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

export const taxpayerStatus = pgEnum("taxpayer_status", ["active", "archived"]);

export const ticketStatus = pgEnum("ticket_status", [
  "received",
  "queued",
  "pending",
  "processing",
  "finalized",
  "failed",
  "cancelled",
]);

export const documentKind = pgEnum("document_kind", [
  "ticket_image",
  "csf_pdf",
  "invoice_pdf",
  "invoice_xml",
  "supporting_document",
]);

export const documentStatus = pgEnum("document_status", [
  "pending",
  "stored",
  "failed",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "pending",
  "finalized",
  "failed",
]);

export const jobType = pgEnum("job_type", [
  "submit_ticket",
  "process_upstream_webhook",
  "refresh_ticket",
  "redeliver_ticket",
  "dispatch_webhook",
]);

export const jobStatus = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const usageMetric = pgEnum("usage_metric", [
  "tickets_submitted",
  "documents_stored",
  "deliveries_sent",
]);

export const refillFrequency = pgEnum("refill_frequency", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const creditLedgerReason = pgEnum("credit_ledger_reason", [
  "initial_grant",
  "refill",
  "ticket_submission",
  "manual_adjustment",
]);

export const plan = pgTable("plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  ticketCreditAllowance: integer("ticket_credit_allowance").notNull().default(0),
  refillFrequency: refillFrequency("refill_frequency").notNull().default("monthly"),
  isDefault: boolean("is_default").notNull().default(false),
  monthlyTicketQuota: integer("monthly_ticket_quota"),
  monthlyDocumentQuota: integer("monthly_document_quota"),
  rateLimitPerMinute: integer("rate_limit_per_minute"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditAccount = pgTable(
  "credit_account",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    balance: integer("balance").notNull().default(0),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    nextRefillAt: timestamp("next_refill_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    planIdx: index("credit_account_plan_idx").on(table.planId),
    nextRefillIdx: index("credit_account_next_refill_idx").on(table.nextRefillAt),
  })
);

export const taxpayer = pgTable(
  "taxpayer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rfc: text("rfc").notNull(),
    legalName: text("legal_name"),
    displayName: text("display_name"),
    status: taxpayerStatus("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgRfcUnique: uniqueIndex("taxpayer_org_rfc_unique").on(
      table.organizationId,
      table.rfc
    ),
    orgIdx: index("taxpayer_org_idx").on(table.organizationId),
  })
);

export const ticket = pgTable(
  "ticket",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    taxpayerId: uuid("taxpayer_id")
      .notNull()
      .references(() => taxpayer.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key"),
    provider: text("provider"),
    providerRequestId: text("provider_request_id"),
    mode: text("mode", { enum: ["live", "test"] }).notNull().default("live"),
    status: ticketStatus("status").notNull().default("received"),
    statusRank: integer("status_rank").notNull().default(0),
    originalFileName: text("original_file_name"),
    errorCode: text("error_code"),
    errorType: text("error_type"),
    errorMessage: text("error_message"),
    submitRequest: jsonb("submit_request"),
    lastResponse: jsonb("last_response"),
    upstreamRaw: jsonb("upstream_raw"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("ticket_org_idx").on(table.organizationId),
    taxpayerIdx: index("ticket_taxpayer_idx").on(table.taxpayerId),
    statusIdx: index("ticket_status_idx").on(table.status),
    idempotencyUnique: uniqueIndex("ticket_org_idempotency_unique")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  })
);

export const creditLedgerEntry = pgTable(
  "credit_ledger_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    accountOrganizationId: text("account_organization_id")
      .notNull()
      .references(() => creditAccount.organizationId, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: creditLedgerReason("reason").notNull(),
    ticketId: uuid("ticket_id"),
    requestId: text("request_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgCreatedIdx: index("credit_ledger_entry_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    ticketIdx: index("credit_ledger_entry_ticket_idx").on(table.ticketId),
  })
);

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    taxpayerId: uuid("taxpayer_id").references(() => taxpayer.id, {
      onDelete: "set null",
    }),
    kind: documentKind("kind").notNull(),
    status: documentStatus("status").notNull().default("pending"),
    originalFileName: text("original_file_name").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes"),
    checksumSha256: text("checksum_sha256"),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata").notNull().default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("document_org_idx").on(table.organizationId),
    taxpayerIdx: index("document_taxpayer_idx").on(table.taxpayerId),
    storageKeyUnique: uniqueIndex("document_storage_key_unique").on(
      table.storageBucket,
      table.storageKey
    ),
  })
);

export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    taxpayerId: uuid("taxpayer_id")
      .notNull()
      .references(() => taxpayer.id, { onDelete: "restrict" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    status: invoiceStatus("status").notNull().default("pending"),
    satUuid: text("sat_uuid"),
    series: text("series"),
    folio: text("folio"),
    issuerTaxpayer: text("issuer_taxpayer"),
    issuerRfc: text("issuer_rfc"),
    total: numeric("total", { precision: 14, scale: 2 }),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketUnique: uniqueIndex("invoice_ticket_unique").on(table.ticketId),
    orgIdx: index("invoice_org_idx").on(table.organizationId),
    taxpayerIdx: index("invoice_taxpayer_idx").on(table.taxpayerId),
  })
);

export const ticketDocument = pgTable(
  "ticket_document",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unique: uniqueIndex("ticket_document_unique").on(
      table.ticketId,
      table.documentId
    ),
    ticketRoleUnique: uniqueIndex("ticket_document_role_unique").on(
      table.ticketId,
      table.role
    ),
  })
);

export const invoiceDocument = pgTable(
  "invoice_document",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unique: uniqueIndex("invoice_document_unique").on(
      table.invoiceId,
      table.documentId
    ),
    invoiceRoleUnique: uniqueIndex("invoice_document_role_unique").on(
      table.invoiceId,
      table.role
    ),
  })
);

export const idempotencyRecord = pgTable(
  "idempotency_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unique: uniqueIndex("idempotency_org_key_unique").on(
      table.organizationId,
      table.idempotencyKey
    ),
  })
);

export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: jobType("type").notNull(),
    status: jobStatus("status").notNull().default("pending"),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    queueIdx: index("job_queue_idx").on(table.status, table.runAt),
    idempotencyUnique: uniqueIndex("job_idempotency_unique")
      .on(table.organizationId, table.type, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  })
);

export const usageCounter = pgTable(
  "usage_counter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    metric: usageMetric("metric").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unique: uniqueIndex("usage_counter_unique").on(
      table.organizationId,
      table.period,
      table.metric
    ),
  })
);

export const planRelations = relations(plan, ({ many }) => ({
  creditAccounts: many(creditAccount),
  ledgerEntries: many(creditLedgerEntry),
}));

export const creditAccountRelations = relations(creditAccount, ({ one, many }) => ({
  organization: one(organization, {
    fields: [creditAccount.organizationId],
    references: [organization.id],
  }),
  plan: one(plan, {
    fields: [creditAccount.planId],
    references: [plan.id],
  }),
  ledgerEntries: many(creditLedgerEntry),
}));

export const taxpayerRelations = relations(taxpayer, ({ one, many }) => ({
  organization: one(organization, {
    fields: [taxpayer.organizationId],
    references: [organization.id],
  }),
  tickets: many(ticket),
  invoices: many(invoice),
  documents: many(document),
}));

export const ticketRelations = relations(ticket, ({ one, many }) => ({
  organization: one(organization, {
    fields: [ticket.organizationId],
    references: [organization.id],
  }),
  taxpayer: one(taxpayer, {
    fields: [ticket.taxpayerId],
    references: [taxpayer.id],
  }),
  invoice: one(invoice),
  documents: many(ticketDocument),
  creditLedgerEntries: many(creditLedgerEntry),
}));

export const creditLedgerEntryRelations = relations(creditLedgerEntry, ({ one }) => ({
  organization: one(organization, {
    fields: [creditLedgerEntry.organizationId],
    references: [organization.id],
  }),
  account: one(creditAccount, {
    fields: [creditLedgerEntry.accountOrganizationId],
    references: [creditAccount.organizationId],
  }),
  plan: one(plan, {
    fields: [creditLedgerEntry.planId],
    references: [plan.id],
  }),
  ticket: one(ticket, {
    fields: [creditLedgerEntry.ticketId],
    references: [ticket.id],
  }),
}));

export const documentRelations = relations(document, ({ one, many }) => ({
  organization: one(organization, {
    fields: [document.organizationId],
    references: [organization.id],
  }),
  taxpayer: one(taxpayer, {
    fields: [document.taxpayerId],
    references: [taxpayer.id],
  }),
  tickets: many(ticketDocument),
  invoices: many(invoiceDocument),
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  organization: one(organization, {
    fields: [invoice.organizationId],
    references: [organization.id],
  }),
  taxpayer: one(taxpayer, {
    fields: [invoice.taxpayerId],
    references: [taxpayer.id],
  }),
  ticket: one(ticket, {
    fields: [invoice.ticketId],
    references: [ticket.id],
  }),
  documents: many(invoiceDocument),
}));

export const ticketDocumentRelations = relations(ticketDocument, ({ one }) => ({
  ticket: one(ticket, {
    fields: [ticketDocument.ticketId],
    references: [ticket.id],
  }),
  document: one(document, {
    fields: [ticketDocument.documentId],
    references: [document.id],
  }),
}));

export const invoiceDocumentRelations = relations(invoiceDocument, ({ one }) => ({
  invoice: one(invoice, {
    fields: [invoiceDocument.invoiceId],
    references: [invoice.id],
  }),
  document: one(document, {
    fields: [invoiceDocument.documentId],
    references: [document.id],
  }),
}));
