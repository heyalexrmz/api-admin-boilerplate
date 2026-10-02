import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn(), execute: vi.fn(), transaction: vi.fn() },
  dispatch: vi.fn(),
  debit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/credits", () => ({ debitTicketCredit: mocks.debit, getCreditBalance: vi.fn() }));
vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchOrganizationWebhookEvent: mocks.dispatch, retryWebhookDelivery: vi.fn(),
}));
vi.mock("@/lib/storage/s3", () => ({
  S3DocumentStore: class { async getBuffer() { return Buffer.from("image"); } },
  documentObjectKey: vi.fn(), getS3StorageConfig: vi.fn(),
}));

import { ticket } from "@/lib/db/schema";
import { tick } from "@/worker/jobs";
import { createTicketFromFormData, createTicketFromJson } from "./core";

// Drive the real worker, submission adapter, and state transitions. Only storage,
// persistence, and outbound webhook delivery are replaced with in-memory boundaries.
let ticketState: Record<string, unknown>;
let jobState: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
const dialect = new PgDialect();
const now = new Date("2026-10-01T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("TOCINO_BASE_URL", "https://provider.example");
  vi.stubEnv("TOCINO_API_KEY", "test-key");
  ticketState = {
    id: "ticket-1", organizationId: "org-1", status: "received", mode: "live",
    idempotencyKey: "original-key", providerRequestId: null,
    submitRequest: { tax_id: "EKU9003173C9", taxpayer: "Test Company" },
    errorCode: null, errorType: null, errorMessage: null, lastResponse: null,
  };
  jobState = {
    id: "job-1", organizationId: "org-1", type: "submit_ticket", status: "pending",
    payload: { ticketId: "ticket-1" }, attempts: 0, maxAttempts: 5, runAt: now,
  };
  mocks.db.select.mockImplementation(() => ({ from: (table: unknown) => ({
    innerJoin: () => ({ where: async () => table === ticket
      ? [{ ticket: structuredClone(ticketState), taxpayer: {} }]
      : [{ document: { kind: "ticket_image", storageKey: "image", originalFileName: "ticket.jpg" } }],
    }),
  }) }));
  mocks.db.update.mockImplementation((table: unknown) => ({ set: (values: Record<string, unknown>) => ({
    where: () => {
      const row = table === ticket ? ticketState : jobState;
      Object.assign(row, values);
      return Object.assign(Promise.resolve(), { returning: async () => [structuredClone(row)] });
    },
  }) }));
  mocks.db.insert.mockReturnValue({ values: () => ({ onConflictDoNothing: async () => {} }) });
  mocks.db.transaction.mockImplementation(async (run: (tx: typeof mocks.db) => Promise<unknown>) => {
    const before = structuredClone({ ticketState, jobState });
    try { return await run(mocks.db); }
    catch (error) {
      ticketState = before.ticketState;
      jobState = before.jobState;
      throw error;
    }
  });
  mocks.db.execute.mockImplementation(async (statement) => {
    const query = dialect.sqlToQuery(statement);
    if (query.sql.includes("for update skip locked")) {
      if (jobState.status !== "pending" || (jobState.runAt as Date) > new Date()) return { rows: [] };
      jobState.status = "running";
      jobState.attempts = Number(jobState.attempts) + 1;
      return { rows: [{
        id: jobState.id, organization_id: jobState.organizationId, type: jobState.type,
        payload: jobState.payload, attempts: jobState.attempts, max_attempts: jobState.maxAttempts,
      }] };
    }
    if (query.sql.includes("status = 'completed'")) jobState.status = "completed";
    return { rows: [] };
  });
  mocks.dispatch.mockResolvedValue(undefined);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function throttled(seconds = 35115) {
  return new Response(JSON.stringify({ detail: `Request was throttled. Expected available in ${seconds} seconds.` }), { status: 429 });
}

describe("name normalization at submission boundaries", () => {
  it("sends and stores the separate names for a historical full-name-only payload", async () => {
    ticketState.submitRequest = { tax_id: "LOTJ900101AB1", taxpayer: "JULIETA SOFIA LOPEZ TORRES" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ nova_request_id: "accepted" }), { status: 200 }));
    await tick();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      taxpayer: "JULIETA SOFIA LOPEZ TORRES", taxpayer_name: "JULIETA SOFIA",
      taxpayer_last_name: "LOPEZ", taxpayer_second_last_name: "TORRES",
      file: Buffer.from("image").toString("base64"),
    });
    expect(ticketState).toMatchObject({
      status: "pending", providerRequestId: "accepted", idempotencyKey: "original-key",
      submitRequest: { ...body, file: "<base64 omitted: 8 chars>" },
    });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("original-key");
    expect(jobState.status).toBe("completed");
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it("fails an ambiguous historical payload once, notifies, and never contacts the provider", async () => {
    const original = { tax_id: "CUPA900101AB1", taxpayer: "ANA DE LA CRUZ PEREZ" };
    ticketState.submitRequest = original;
    await tick();
    expect(ticketState).toMatchObject({
      status: "failed", errorCode: "ambiguous_taxpayer_name", errorType: "validation",
      upstreamRaw: { phase: "validation", http_status: null, body: { param: "taxpayer" } },
      submitRequest: original,
      lastResponse: { status: "failed", error: { code: "ambiguous_taxpayer_name" } },
    });
    expect(jobState).toMatchObject({ status: "completed", attempts: 1 });
    expect(mocks.dispatch.mock.calls.filter((call) => call[1] === "ticket.failed")).toHaveLength(1);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it.each(["json", "multipart"])("rejects an ambiguous new %s request before persistence or charging", async (format) => {
    const input = { organizationId: "org-1", apiKeyId: "key-1", mode: "live" as const, requestId: "request-1" };
    const fields = { tax_id: "CUPA900101AB1", taxpayer: "ANA DE LA CRUZ PEREZ" };
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
    formData.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "ticket.jpg", { type: "image/jpeg" }));
    const request = format === "json"
      ? createTicketFromJson({ ...input, body: { ...fields, file: "/9j/", file_name: "ticket.jpg" } })
      : createTicketFromFormData({ ...input, formData });
    await expect(request).rejects.toMatchObject({ status: 400, code: "ambiguous_taxpayer_name" });
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.debit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("immediate submission failures", () => {
  it.each([35115, 1793])("fails and notifies immediately even when throttling suggests waiting %i seconds", async (seconds) => {
    fetchMock.mockResolvedValueOnce(throttled(seconds));
    await tick();
    expect(ticketState).toMatchObject({
      status: "failed", errorCode: "UPSTREAM_RATE_LIMITED", errorType: "quota",
      upstreamRaw: { http_status: 429, retry_after_seconds: seconds },
    });
    expect(jobState).toMatchObject({ status: "completed", attempts: 1, runAt: now });
    const failures = mocks.dispatch.mock.calls.filter((call) => call[1] === "ticket.failed");
    expect(failures).toHaveLength(1);
    expect(failures[0][2]).toMatchObject({
      status: "failed", error: { code: "UPSTREAM_RATE_LIMITED", type: "quota" },
    });
    expect(failures[0][2].error.message).toContain("límite temporal");
    vi.setSystemTime(new Date(now.getTime() + (seconds + 1) * 1000));
    await tick();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 422, 500])("notifies an HTTP %i rejection in the same worker execution", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Provider diagnostic" }), { status }));
    await tick();
    expect(ticketState.status).toBe("failed");
    expect(jobState.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.dispatch.mock.calls.filter((call) => call[1] === "ticket.failed")).toHaveLength(1);
  });

  it("notifies a connection failure without resubmitting the ticket", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await tick();
    expect(ticketState).toMatchObject({ status: "failed", errorCode: "UPSTREAM_UNAVAILABLE", errorType: "connection" });
    expect(jobState.status).toBe("completed");
    expect(mocks.dispatch.mock.calls.filter((call) => call[1] === "ticket.failed")).toHaveLength(1);
  });

  it.each(["failed", "not_invoiceable", "finalized", "cancelled", "pending"])("does not resubmit a %s ticket", async (status) => {
    ticketState.status = status;
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
