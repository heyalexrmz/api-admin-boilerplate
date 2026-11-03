import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

// Run against a disposable, schema-initialized local database:
// TICKET_RETRY_TEST_DATABASE_URL=postgresql://.../taxo_retry_test pnpm test lib/facturador/availability.integration.test.ts
vi.mock("@/lib/db", async () => {
  const connectionString = process.env.TICKET_RETRY_TEST_DATABASE_URL;
  if (!connectionString) return { db: undefined };
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/taxo_retry_test") {
    throw new Error("Availability integration tests require an isolated local taxo_retry_test database.");
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle({ client: new Pool({ connectionString }), schema }) };
});
vi.mock("@/lib/storage/s3", () => ({
  S3DocumentStore: class { async put() {} async getBuffer() { return Buffer.from("image"); } },
  documentObjectKey: vi.fn(() => "key"), getS3StorageConfig: vi.fn(() => ({ bucket: "test" })),
}));
vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchOrganizationWebhookEvent: vi.fn(), retryWebhookDelivery: vi.fn(),
}));

import { db } from "@/lib/db";
import {
  creditAccount, creditLedgerEntry, idempotencyRecord, organization, plan, serviceOverride,
  serviceStatus, taxpayer, ticket, webhook, workerHeartbeat,
} from "@/lib/db/schema";
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch";
import { createTicketFromJson } from "./core";
import {
  clearServiceHealthCache, clearServiceOverride, measureServiceHealth, publishServiceHealth,
  recordWorkerHeartbeat, setServiceOverride,
} from "./service-health";
import { STALE_TICKET_SLA_MS, sweepStaleTickets } from "./stale-tickets";

const orgId = "availability-org";
const body = { tax_id: "EKU9003173C9", taxpayer: "Test Company", file: "/9j/", file_name: "ticket.jpg" };
const create = (idempotencyKey: string | null, overrides: Record<string, unknown> = {}) =>
  createTicketFromJson({
    organizationId: orgId, apiKeyId: "key-1", mode: "live", requestId: "req-1",
    idempotencyKey, body: { ...body, ...overrides }, defer: () => {},
  });
const ticketsFor = () => db.select().from(ticket).where(eq(ticket.organizationId, orgId));
const balance = async () => (await db.select().from(creditAccount))[0]!.balance;
const dispatched = (type: string) =>
  vi.mocked(dispatchOrganizationWebhookEvent).mock.calls.filter((call) => call[1] === type);

describe.skipIf(!process.env.TICKET_RETRY_TEST_DATABASE_URL)("availability with real PostgreSQL", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(dispatchOrganizationWebhookEvent).mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await db.execute(sql`truncate table organization, plan, service_override, service_status, worker_heartbeat cascade`);
    clearServiceHealthCache();
    await db.insert(organization).values({ id: orgId, name: "Availability", slug: "availability" });
    const [tier] = await db.insert(plan).values({ name: "Test" }).returning();
    await db.insert(creditAccount).values({ organizationId: orgId, planId: tier!.id, balance: 10, nextRefillAt: new Date("2099-01-01") });
    await db.insert(webhook).values({
      organizationId: orgId, name: "hook", url: "https://example.com/hook", secretPreview: "x",
      events: ["service.down", "service.degraded", "service.recovered", "ticket.failed"],
    });
    await recordWorkerHeartbeat("worker-test");
  });
  afterAll(async () => { await db.$client.end(); });

  describe("intake gate", () => {
    it("rejects with 503 + Retry-After without creating or charging, then the same key succeeds", async () => {
      await setServiceOverride({ mode: "live", component: "extraction", status: "down", reason: "Extracción apagada." });
      const startedAt = Date.now();
      await expect(create("key-a")).rejects.toMatchObject({
        status: 503, code: "SERVICE_UNAVAILABLE", type: "unavailable", retryable: true, retryAfterSeconds: 60,
      });
      expect(Date.now() - startedAt).toBeLessThan(2_000);
      expect(await ticketsFor()).toHaveLength(0);
      expect(await db.select().from(idempotencyRecord)).toHaveLength(0);
      expect(await db.select().from(creditLedgerEntry)).toHaveLength(0);
      expect(await balance()).toBe(10);

      await clearServiceOverride({ mode: "live" });
      const created = await create("key-a");
      expect(created).toMatchObject({ replayed: false, response: { status: "received", delayed: false } });
      const replay = await create("key-a");
      expect(replay).toMatchObject({ replayed: true, response: { id: created.response.id } });
      expect(await ticketsFor()).toHaveLength(1);
      expect(await balance()).toBe(9);
    });

    it("still replays an existing ticket while the service is down", async () => {
      const created = await create("key-b");
      await setServiceOverride({ mode: "live", component: "invoicing", status: "down", reason: "Caído." });
      expect(await create("key-b")).toMatchObject({ replayed: true, response: { id: created.response.id } });
    });

    it("accepts while degraded and says the ticket is delayed", async () => {
      await setServiceOverride({ mode: "live", component: "invoicing", status: "degraded", reason: "Lento." });
      expect((await create("key-c")).response).toMatchObject({ delayed: true, delay_reason: "Lento." });
    });

    it("never applies live outages to sandbox keys", async () => {
      await setServiceOverride({ mode: "live", component: "extraction", status: "down", reason: "Caído." });
      const sandbox = await createTicketFromJson({
        organizationId: orgId, apiKeyId: "key-1", mode: "test", requestId: "req-1",
        idempotencyKey: "sandbox", body, defer: () => {},
      });
      expect(sandbox.response.livemode).toBe(false);
    });
  });

  describe("idempotent retries", () => {
    it("turns concurrent requests with one key into one ticket and one charge", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => create("key-concurrent")));
      expect(new Set(results.map((result) => result.response.id)).size).toBe(1);
      expect(results.filter((result) => !result.replayed)).toHaveLength(1);
      expect(await ticketsFor()).toHaveLength(1);
      expect(await db.select().from(creditLedgerEntry)).toHaveLength(1);
      expect(await balance()).toBe(9);
    });

    it("rejects the same key with a different body", async () => {
      await create("key-d");
      await expect(create("key-d", { tax_id: "XAXX010101000" })).rejects.toMatchObject({
        status: 409, code: "idempotency_key_reused", retryable: false,
      });
      expect(await ticketsFor()).toHaveLength(1);
    });

    it("returns a ticket that exists without a stored response instead of failing", async () => {
      const [owner] = await db.insert(taxpayer).values({ organizationId: orgId, rfc: "EKU9003173C9" }).returning();
      const [legacy] = await db.insert(ticket).values({
        organizationId: orgId, taxpayerId: owner!.id, idempotencyKey: "key-legacy", status: "pending",
      }).returning();
      expect(await create("key-legacy")).toMatchObject({ replayed: true, response: { id: legacy!.id } });
      expect(await db.select().from(creditLedgerEntry)).toHaveLength(0);
      expect(await create("key-legacy")).toMatchObject({ replayed: true, response: { id: legacy!.id } });
    });

    it("rolls back the charge when the ticket cannot be created", async () => {
      await db.execute(sql`alter table ticket add constraint availability_guard check (original_file_name <> 'ticket.jpg')`);
      try {
        await expect(create("key-e")).rejects.toThrow();
        expect(await balance()).toBe(10);
        expect(await db.select().from(creditLedgerEntry)).toHaveLength(0);
      } finally {
        await db.execute(sql`alter table ticket drop constraint availability_guard`);
      }
      expect((await create("key-e")).replayed).toBe(false);
      expect(await balance()).toBe(9);
    });
  });

  describe("measured status and incident webhooks", () => {
    it("reports extraction down when the worker stops polling", async () => {
      await db.update(workerHeartbeat).set({ lastSeenAt: new Date(Date.now() - 5 * 60_000) });
      const health = await measureServiceHealth("live");
      expect(health).toMatchObject({ status: "down", components: { extraction: { status: "down" } } });
    });

    it("reports invoicing down from recent infrastructure failures", async () => {
      const [owner] = await db.insert(taxpayer).values({ organizationId: orgId, rfc: "EKU9003173C9" }).returning();
      await db.insert(ticket).values(Array.from({ length: 3 }, () => ({
        organizationId: orgId, taxpayerId: owner!.id, status: "failed" as const,
        errorCode: "UPSTREAM_UNAVAILABLE", processingStartedAt: new Date(),
      })));
      expect((await measureServiceHealth("live")).components.invoicing.status).toBe("down");
    });

    it("emits service.down once and service.recovered on recovery", async () => {
      await setServiceOverride({ mode: "live", component: "extraction", status: "down", reason: "Extracción apagada." });
      await publishServiceHealth(await measureServiceHealth("live"));
      await publishServiceHealth(await measureServiceHealth("live"));
      expect(dispatched("service.down")).toHaveLength(1);
      expect(dispatched("service.down")[0]![2]).toMatchObject({
        object: "service_status", status: "down", previous_status: "operational",
        components: { extraction: { status: "down", reason: "Extracción apagada." } },
      });
      expect(dispatched("service.down")[0]![3]).toMatchObject({ livemode: true });

      await clearServiceOverride({ mode: "live" });
      await publishServiceHealth(await measureServiceHealth("live"));
      expect(dispatched("service.recovered")).toHaveLength(1);
      expect((await db.select().from(serviceStatus).where(eq(serviceStatus.mode, "live")))[0]!.status).toBe("operational");
    });

    it("lets expired overrides lapse", async () => {
      await setServiceOverride({
        mode: "live", component: "extraction", status: "down", reason: "x", expiresAt: new Date(Date.now() - 1000),
      });
      expect((await measureServiceHealth("live")).status).toBe("operational");
      expect(await db.select().from(serviceOverride)).toHaveLength(1);
    });
  });

  describe("stale ticket SLA", () => {
    it("fails unsent tickets as retryable and refunds them once; unconfirmed sends are not retryable", async () => {
      const old = new Date(Date.now() - STALE_TICKET_SLA_MS - 60_000);
      const [owner] = await db.insert(taxpayer).values({ organizationId: orgId, rfc: "EKU9003173C9" }).returning();
      const [unsent, sending, waiting, fresh] = await db.insert(ticket).values([
        { organizationId: orgId, taxpayerId: owner!.id, status: "received" as const, updatedAt: old },
        { organizationId: orgId, taxpayerId: owner!.id, status: "processing" as const, processingStartedAt: old, updatedAt: old },
        { organizationId: orgId, taxpayerId: owner!.id, status: "pending" as const, providerRequestId: "p", updatedAt: old },
        { organizationId: orgId, taxpayerId: owner!.id, status: "received" as const },
      ]).returning();
      const [account] = await db.select().from(creditAccount);
      await db.update(creditAccount).set({ balance: 8 });
      await db.insert(creditLedgerEntry).values([unsent!, sending!].map((row) => ({
        organizationId: orgId, accountOrganizationId: orgId, planId: account!.planId,
        delta: -1, balanceAfter: 8, reason: "ticket_submission" as const, ticketId: row.id,
      })));

      expect(await sweepStaleTickets()).toEqual({ neverSent: 1, unconfirmed: 1 });
      expect(await sweepStaleTickets()).toEqual({ neverSent: 0, unconfirmed: 0 });

      const byId = Object.fromEntries((await ticketsFor()).map((row) => [row.id, row]));
      expect(byId[unsent!.id]).toMatchObject({ status: "failed", errorCode: "SERVICE_UNAVAILABLE" });
      expect(byId[sending!.id]).toMatchObject({ status: "failed", errorCode: "UPSTREAM_UNAVAILABLE", errorType: "connection" });
      expect(byId[waiting!.id]!.status).toBe("pending");
      expect(byId[fresh!.id]!.status).toBe("received");
      expect(await balance()).toBe(9);

      const failures = dispatched("ticket.failed").map((call) => call[2] as { id: string; error: { retryable: boolean; message: string } });
      expect(failures).toHaveLength(2);
      expect(failures.find((event) => event.id === unsent!.id)!.error.retryable).toBe(true);
      expect(failures.find((event) => event.id === sending!.id)!.error.retryable).toBe(false);
      expect(JSON.stringify(failures)).not.toMatch(/tocino|nova|timbre/i);
    });
  });
});
