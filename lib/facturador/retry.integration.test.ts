import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

// Run against a disposable, schema-initialized local database:
// TICKET_RETRY_TEST_DATABASE_URL=postgresql://.../taxo_retry_test pnpm test lib/facturador/retry.integration.test.ts
vi.mock("@/lib/db", async () => {
  const connectionString = process.env.TICKET_RETRY_TEST_DATABASE_URL;
  if (!connectionString) return { db: undefined };
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/taxo_retry_test") {
    throw new Error("Retry integration tests require an isolated local taxo_retry_test database.");
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle({ client: new Pool({ connectionString }), schema }) };
});
vi.mock("@/lib/storage/s3", () => ({
  S3DocumentStore: class { async getBuffer() { return Buffer.from("original-image"); } },
  documentObjectKey: vi.fn(), getS3StorageConfig: vi.fn(),
}));
vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchOrganizationWebhookEvent: vi.fn(), retryWebhookDelivery: vi.fn(),
}));

import { db } from "@/lib/db";
import { creditAccount, creditLedgerEntry, document, invoice, job, organization, plan, taxpayer, ticket, ticketDocument } from "@/lib/db/schema";
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch";
import { tick } from "@/worker/jobs";
import { retryTicketSubmission } from "./retry";

const ticketId = "ede4dccc-a001-45d2-a6ed-2af7f4b57f02";
const input = { ticketId, organizationId: "retry-org", userId: "manager" };
const originalFailure = { phase: "submit", http_status: 500, body: { message: "Internal error" } };
let taxpayerId: string;

describe.skipIf(!process.env.TICKET_RETRY_TEST_DATABASE_URL)("manual retries with real PostgreSQL and worker", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("TOCINO_BASE_URL", "https://provider.example");
    vi.stubEnv("TOCINO_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nova_request_id: "provider-receipt" }), { status: 200 })));
    await db.execute(sql`truncate table organization, plan cascade`);
    await db.insert(organization).values({ id: input.organizationId, name: "Retry tests", slug: "retry-tests" });
    const [owner] = await db.insert(taxpayer).values({ organizationId: input.organizationId, rfc: "TEST010101AAA" }).returning();
    taxpayerId = owner.id;
    await db.insert(ticket).values({
      id: ticketId, organizationId: input.organizationId, taxpayerId,
      status: "failed", mode: "live", statusRank: 100, idempotencyKey: "original-key",
      errorCode: "UPSTREAM_UNAVAILABLE", errorType: "upstream", errorMessage: "Unavailable",
      upstreamRaw: originalFailure, processingStartedAt: new Date(),
      originalFileName: "receipt.png", submitRequest: { tax_id: "TEST010101AAA", taxpayer: "Test Name", file: "<omitted>" },
    });
    const [image] = await db.insert(document).values({
      organizationId: input.organizationId, kind: "ticket_image", status: "stored",
      originalFileName: "receipt.png", contentType: "image/png", storageBucket: "test", storageKey: "original-image",
    }).returning();
    await db.insert(ticketDocument).values({ ticketId, documentId: image.id, role: "ticket_image" });
    const [tier] = await db.insert(plan).values({ name: "Test" }).returning();
    await db.insert(creditAccount).values({ organizationId: input.organizationId, planId: tier.id, balance: 19, nextRefillAt: new Date("2099-01-01") });
    await db.insert(creditLedgerEntry).values({ organizationId: input.organizationId, accountOrganizationId: input.organizationId, planId: tier.id, delta: -1, balanceAfter: 19, reason: "ticket_submission", ticketId });
    await db.insert(job).values({ organizationId: input.organizationId, type: "submit_ticket", status: "completed", attempts: 1, payload: { ticketId }, idempotencyKey: `submit_ticket:${ticketId}` });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  afterAll(async () => { await db.$client.end(); });

  async function currentTicket() {
    return (await db.select().from(ticket).where(eq(ticket.id, ticketId)))[0];
  }

  it("resubmits the original ticket through the worker without charging again", async () => {
    expect(await retryTicketSubmission(input)).toEqual({ success: true });
    expect(await currentTicket()).toMatchObject({ status: "received", errorCode: null, processingStartedAt: null });
    const jobs = await db.select().from(job).where(eq(job.status, "pending"));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload).toMatchObject({ ticketId, retriedBy: "manager", previousFailure: { upstreamRaw: originalFailure } });

    await tick();
    expect(await currentTicket()).toMatchObject({ status: "pending", providerRequestId: "provider-receipt", idempotencyKey: "original-key" });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "original-key" }),
      body: JSON.stringify({ tax_id: "TEST010101AAA", taxpayer: "Test Name", country: "México", file: Buffer.from("original-image").toString("base64"), file_name: "receipt.png" }),
    }));
    expect(await db.select().from(creditLedgerEntry)).toHaveLength(1);
    expect((await db.select().from(creditAccount))[0].balance).toBe(19);
    expect(dispatchOrganizationWebhookEvent).toHaveBeenCalledWith(input.organizationId, "ticket.processing", expect.any(Object), expect.any(Object));
  });

  it("serializes concurrent clicks into a single new job", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => retryTicketSubmission(input)));
    expect(results.filter((result) => "success" in result)).toHaveLength(1);
    expect(await db.select().from(job).where(eq(job.status, "pending"))).toHaveLength(1);
  });

  it("scopes access to the active organization", async () => {
    expect(await retryTicketSubmission({ ...input, organizationId: "other-org" })).toHaveProperty("error");
    expect((await currentTicket()).status).toBe("failed");
    expect(await db.select().from(job)).toHaveLength(1);
  });

  it.each(["received", "queued", "processing", "pending", "finalized", "cancelled", "not_invoiceable"] as const)("rejects stale requests for %s tickets", async (status) => {
    await db.update(ticket).set({ status }).where(eq(ticket.id, ticketId));
    expect(await retryTicketSubmission(input)).toHaveProperty("error");
    expect(await db.select().from(job)).toHaveLength(1);
  });

  it("blocks retries after a provider receipt", async () => {
    await db.update(ticket).set({ providerRequestId: "already-accepted" }).where(eq(ticket.id, ticketId));
    expect(await retryTicketSubmission(input)).toHaveProperty("error");
  });

  it("blocks retries when an invoice exists", async () => {
    await db.insert(invoice).values({ organizationId: input.organizationId, taxpayerId, ticketId, status: "failed" });
    expect(await retryTicketSubmission(input)).toHaveProperty("error");
  });

  it.each(["pending", "running"] as const)("waits for the previous %s submission job to finish", async (status) => {
    await db.update(job).set({ status });
    expect(await retryTicketSubmission(input)).toHaveProperty("error");
    expect((await currentTicket()).status).toBe("failed");
    expect(await db.select().from(job)).toHaveLength(1);
  });

  it("rolls back the queued job if resetting the ticket fails", async () => {
    await db.execute(sql`alter table ticket add constraint retry_test_guard check (status <> 'received')`);
    try {
      await expect(retryTicketSubmission(input)).rejects.toThrow();
      expect(await db.select().from(job)).toHaveLength(1);
      expect((await currentTicket()).status).toBe("failed");
    } finally {
      await db.execute(sql`alter table ticket drop constraint retry_test_guard`);
    }
  });

  it("permits another manual retry after a new failure without automatic resubmission", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Internal error" }), { status: 500 }));
    await retryTicketSubmission(input);
    await tick();
    expect((await currentTicket()).status).toBe("failed");
    await tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await retryTicketSubmission(input)).toEqual({ success: true });
    await tick();
    expect((await currentTicket()).status).toBe("pending");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await db.select().from(creditLedgerEntry)).toHaveLength(1);
  });
});
