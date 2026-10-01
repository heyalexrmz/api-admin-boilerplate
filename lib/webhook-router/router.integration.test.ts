import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const testDatabase = vi.hoisted(() => {
  const value = process.env.WEBHOOK_ROUTER_TEST_DATABASE_URL;
  if (value) {
    const url = new URL(value);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/webhook_router_test") {
      throw new Error("Integration tests require a disposable local database named webhook_router_test.");
    }
    process.env.DATABASE_URL = value;
  }
  return value;
});
vi.mock("@/lib/server/webhook-url-policy", () => ({ validateWebhookUrlForDelivery: vi.fn(async () => null) }));

import { db } from "@/lib/db";
import { organization, taxpayer, ticket } from "@/lib/db/schema";
import { acceptRouterWebhook, ROUTER_PATH } from "./ingress";
import { tickRouterDelivery } from "./consumer";
import { claimRouterDelivery, finishRouterDelivery } from "./store";
import { createWebhookRouterServer } from "./server";

const target = "https://destination.example/webhook";
const token = "integration-test-token";
const fetchMock = vi.fn<typeof fetch>();
const nativeFetch = globalThis.fetch;

function request(payload: Record<string, unknown>) {
  return new Request(`https://router.example${ROUTER_PATH}`, {
    method: "POST", headers: { "content-type": "application/json", "typeform-signature": token }, body: JSON.stringify(payload),
  });
}
async function seedTicket(orgId = "test-org", requestId = "request-1", key = "key-1") {
  await db.insert(organization).values({ id: orgId, name: "Test", slug: orgId }).onConflictDoNothing();
  const [taxpayerRow] = await db.insert(taxpayer).values({ organizationId: orgId, rfc: "TEST010101AAA" }).returning();
  const [row] = await db.insert(ticket).values({ organizationId: orgId, taxpayerId: taxpayerRow!.id, idempotencyKey: key, providerRequestId: requestId, status: "pending" }).returning();
  return row!;
}

describe.skipIf(!testDatabase)("webhook router with PostgreSQL", () => {
  beforeAll(async () => {
    // The baseline schema must already exist in this disposable database.
    // Reapply the exact migration, verifying its unique index and queue schema.
    await db.execute(sql`drop table if exists upstream_webhook_delivery`);
    const migration = await readFile(new URL("../db/migrations/0008_webhook_router.sql", import.meta.url), "utf8");
    await db.execute(sql.raw(migration));
  });
  beforeEach(async () => {
    await db.execute(sql`truncate upstream_webhook_delivery, organization cascade`);
    vi.stubEnv("UPSTREAM_WEBHOOK_HEADER", "typeform-signature");
    vi.stubEnv("UPSTREAM_WEBHOOK_TOKEN", token);
    vi.stubEnv("WEBHOOK_ROUTER_FORWARD_URLS", JSON.stringify([target]));
    vi.stubEnv("DOCUMENT_SIGNING_SECRET", "test-signing-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  afterAll(async () => { await db.$client.end(); });

  it("finalizes a ticket while an independent destination is failing", async () => {
    await seedTicket();
    const response = await acceptRouterWebhook(request({ nova_request_id: "request-1", status: "finalized", invoice: { id: "invoice-1", invoice_total: "123.45" } }));
    expect(response.status).toBe(202);
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await Promise.all([tickRouterDelivery("local"), tickRouterDelivery("forward")]);
    const result = await db.execute(sql`select status from ticket`);
    expect(result.rows[0]!.status).toBe("finalized");
    const deliveries = await db.execute(sql`select destination, status, attempts from upstream_webhook_delivery order by destination`);
    expect(deliveries.rows).toEqual([
      { destination: target, status: "pending", attempts: 1 },
      { destination: "local", status: "completed", attempts: 1 },
    ]);
    expect((await db.execute(sql`select total from invoice`)).rows[0]!.total).toBe("123.45");
  });

  it("records a failed ticket and its reason without waiting for forwarding", async () => {
    await seedTicket();
    await acceptRouterWebhook(request({ nova_request_id: "request-1", status: "failed", error_msg: "Ticket vencido" }));
    await tickRouterDelivery("local");
    const { rows } = await db.execute(sql`select status, error_code, error_message from ticket`);
    expect(rows[0]).toEqual({ status: "failed", error_code: "MERCHANT_ERROR", error_message: "Ticket vencido" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deduplicates simultaneous callbacks and claims each destination once", async () => {
    const payload = { nova_request_id: "request-1", status: "failed" };
    await Promise.all(Array.from({ length: 8 }, () => acceptRouterWebhook(request(payload))));
    expect((await db.execute(sql`select count(*)::int as count from upstream_webhook_delivery`)).rows[0]!.count).toBe(2);
    const claims = await Promise.all([claimRouterDelivery("forward"), claimRouterDelivery("forward")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("recovers abandoned claims and rejects completion by the old lease owner", async () => {
    await acceptRouterWebhook(request({ nova_request_id: "request-1", status: "failed" }));
    const abandoned = (await claimRouterDelivery("forward"))!;
    await db.execute(sql`update upstream_webhook_delivery set locked_at = now() - interval '6 minutes' where id = ${abandoned.id}`);
    const recovered = (await claimRouterDelivery("forward"))!;
    expect(recovered).toMatchObject({ id: abandoned.id, attempts: 2 });
    expect(recovered.locked_by).not.toBe(abandoned.locked_by);
    await finishRouterDelivery(abandoned, { ok: true });
    expect((await db.execute(sql`select status from upstream_webhook_delivery where id = ${abandoned.id}`)).rows[0]!.status).toBe("running");
    await finishRouterDelivery(recovered, { ok: true });
    expect((await db.execute(sql`select status from upstream_webhook_delivery where id = ${abandoned.id}`)).rows[0]!.status).toBe("completed");
  });

  it("forwards an early callback and finishes it locally after the ticket is registered", async () => {
    await acceptRouterWebhook(request({ nova_request_id: "request-1", status: "finalized", invoice: { id: "invoice-1" } }));
    await tickRouterDelivery("local");
    await tickRouterDelivery("forward");
    expect((await db.execute(sql`select last_error from upstream_webhook_delivery where destination = 'local'`)).rows[0]!.last_error).toBe("ticket_not_found");
    await seedTicket();
    await db.execute(sql`update upstream_webhook_delivery set run_at = now() where destination = 'local'`);
    await tickRouterDelivery("local");
    expect((await db.execute(sql`select status from ticket`)).rows[0]!.status).toBe("finalized");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses the request ID when organizations share a client idempotency key", async () => {
    const first = await seedTicket("org-first", "request-first", "same-key");
    const second = await seedTicket("org-second", "request-second", "same-key");
    await acceptRouterWebhook(request({ nova_request_id: "request-second", idempotency_key: "same-key", status: "failed", error_msg: "Expired" }));
    await tickRouterDelivery("local");
    const { rows } = await db.execute(sql`select id, status from ticket`);
    expect(rows.find((row) => row.id === first.id)!.status).toBe("pending");
    expect(rows.find((row) => row.id === second.id)!.status).toBe("failed");
  });

  it("does not guess when an idempotency key is ambiguous", async () => {
    await seedTicket("org-first", "request-first", "same-key");
    await seedTicket("org-second", "request-second", "same-key");
    await acceptRouterWebhook(request({ idempotency_key: "same-key", status: "failed", error_msg: "Expired" }));
    await tickRouterDelivery("local");
    expect((await db.execute(sql`select status from ticket`)).rows.every((row) => row.status === "pending")).toBe(true);
  });

  it("persists retry delays and exhausts a destination without replaying completed deliveries", async () => {
    await acceptRouterWebhook(request({ nova_request_id: "request-1", status: "failed" }));
    const row = (await claimRouterDelivery("forward"))!;
    await finishRouterDelivery(row, { ok: false, error: "destination_http_429", httpStatus: 429, retryAfterSeconds: 35115 });
    const delay = await db.execute(sql`select extract(epoch from (run_at - now()))::int as seconds from upstream_webhook_delivery where id = ${row.id}`);
    expect(Number(delay.rows[0]!.seconds)).toBeGreaterThanOrEqual(35110);
    expect(await claimRouterDelivery("forward")).toBeNull();
    await db.execute(sql`update upstream_webhook_delivery set attempts = max_attempts - 1, run_at = now() where id = ${row.id}`);
    const finalAttempt = (await claimRouterDelivery("forward"))!;
    await finishRouterDelivery(finalAttempt, { ok: false, error: "destination_http_500", httpStatus: 500 });
    expect((await db.execute(sql`select status from upstream_webhook_delivery where id = ${row.id}`)).rows[0]!.status).toBe("failed");
    expect(await claimRouterDelivery("forward")).toBeNull();
  });

  it("serves the native HTTP endpoint and database-backed health check", async () => {
    const server = createWebhookRouterServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address() as { port: number };
      const base = `http://127.0.0.1:${address.port}`;
      expect((await nativeFetch(`${base}/health`)).status).toBe(200);
      expect((await nativeFetch(`${base}${ROUTER_PATH}`, { method: "POST", body: "{}" })).status).toBe(401);
      const response = await nativeFetch(`${base}${ROUTER_PATH}`, { method: "POST", headers: { "content-type": "application/json", "typeform-signature": token }, body: '{"status":"processing"}' });
      expect(response.status).toBe(202);
      expect((await db.execute(sql`select count(*)::int as count from upstream_webhook_delivery`)).rows[0]!.count).toBe(2);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
