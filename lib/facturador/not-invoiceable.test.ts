import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), update: vi.fn(), execute: vi.fn() },
  dispatch: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/credits", () => ({ debitTicketCredit: vi.fn(), getCreditBalance: vi.fn() }));
vi.mock("@/lib/webhook-dispatch", () => ({ dispatchOrganizationWebhookEvent: mocks.dispatch }));

import { applyTocinoWebhookEvent, expireTicketIfStale, getStats } from "./core";
import { ticketFinalResponseView, ticketProviderResponseView } from "./responses";

let ticketState: Record<string, unknown>;
const reasons = [
  "Fecha del ticket fuera del rango facturable establecido por el comercio.",
  "La imagen del ticket esta incompleta y ciertos datos requeridos no son visibles.",
];

beforeEach(() => {
  vi.clearAllMocks();
  ticketState = {
    id: "ticket-1", organizationId: "org-1", mode: "live", status: "pending",
    providerRequestId: "request-1", idempotencyKey: "key-1",
  };
  const query = { where: () => ({ limit: async () => [{ ticket: { ...ticketState }, taxpayer: {} }] }) };
  mocks.db.select.mockReturnValue({ from: () => ({ ...query, innerJoin: () => query }) });
  mocks.db.update.mockReturnValue({ set: (values: Record<string, unknown>) => ({
    where: async () => { Object.assign(ticketState, values); },
  }) });
  mocks.dispatch.mockResolvedValue(undefined);
});

describe("non-invoiceable ticket outcomes", () => {
  it.each(reasons)("persists and publishes the non-invoiceable reason: %s", async (reason) => {
    const raw = {
      nova_request_id: "request-1", status: "failed",
      invoice: { not_invoiceable_cause: reason },
    };
    await applyTocinoWebhookEvent(raw);
    expect(ticketState).toMatchObject({
      status: "not_invoiceable", statusRank: 100,
      errorCode: "NOT_INVOICEABLE", errorType: "site", errorMessage: reason, upstreamRaw: raw,
    });
    expect(mocks.dispatch).toHaveBeenCalledWith("org-1", "ticket.failed", {
      object: "ticket", id: "ticket-1", status: "not_invoiceable",
      error: { code: "NOT_INVOICEABLE", type: "site", message: reason },
    }, { id: "ticket-1", idempotencyKey: "key-1", livemode: true });
    expect(mocks.dispatch).toHaveBeenCalledWith("org-1", "invoice.failed", expect.objectContaining({
      status: "failed", error: { code: "NOT_INVOICEABLE", type: "site", message: reason },
    }), expect.anything());

    const error = { code: "NOT_INVOICEABLE", type: "site", message: reason };
    expect(ticketProviderResponseView({
      ticketId: "ticket-1", status: "not_invoiceable", livemode: true, error,
    })).toMatchObject({ status: "not_invoiceable", message: "Ticket is not invoiceable.", error });
    expect(ticketFinalResponseView({
      ticketId: "ticket-1", status: "not_invoiceable", livemode: true, error,
      invoiceId: null, invoiceUuid: null,
    })).toMatchObject({ status: "not_invoiceable", invoice: null, error });
  });

  it.each([
    { status: "failed", error_code: "NOT_INVOICEABLE", error_msg: reasons[0] },
    { status: "not_invoiceable", error_msg: reasons[0] },
    { status: "NOT_INVOICEABLE" },
  ])("recognizes a non-invoiceable code or status without an invoice cause: %j", async (payload) => {
    await applyTocinoWebhookEvent({ nova_request_id: "request-1", ...payload });
    expect(ticketState).toMatchObject({ status: "not_invoiceable", errorCode: "NOT_INVOICEABLE" });
    expect(ticketState.errorMessage).toBe(payload.error_msg ?? "Este ticket no es facturable.");
  });

  it("does not reclassify other site errors based on the category or message", async () => {
    await applyTocinoWebhookEvent({ nova_request_id: "request-1", status: "failed", error_msg: "Ticket vencido" });
    expect(ticketState).toMatchObject({ status: "failed", errorCode: "MERCHANT_ERROR", errorType: "site" });
    expect(mocks.dispatch).toHaveBeenCalledWith("org-1", "ticket.failed", expect.objectContaining({ status: "failed" }), expect.anything());
  });

  it("treats non-invoiceable tickets as terminal when the timeout job runs", async () => {
    ticketState.status = "not_invoiceable";
    expect(await expireTicketIfStale({ organizationId: "org-1", ticketId: "ticket-1" }))
      .toEqual({ outcome: "already_terminal", status: "not_invoiceable" });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

describe("ticket health statistics", () => {
  it("counts non-invoiceable tickets separately and excludes them and unfinished work from rates", async () => {
    const counts = { finalized: 8, failed: 2, not_invoiceable: 30, pending: 10, received: 3, queued: 2, processing: 5, cancelled: 4 };
    mocks.db.execute.mockResolvedValue({ rows: Object.entries(counts).map(([status, count]) => ({ status, count })) });
    expect(await getStats("org-1", 7)).toEqual({
      object: "stats", window_days: 7,
      tickets: { total: 64, by_status: counts, error_rate: 0.2, success_rate: 0.8 },
    });
    const query = new PgDialect().sqlToQuery(mocks.db.execute.mock.calls[0][0]);
    expect(query.params).toContain("org-1");
    expect(query.sql).toContain("created_at >=");
  });

  it.each([
    { rows: [] },
    { rows: [{ status: "not_invoiceable", count: 10 }] },
    { rows: [{ status: "pending", count: 5 }] },
  ])("returns finite zero rates without evaluable results: %j", async ({ rows }) => {
      mocks.db.execute.mockResolvedValue({ rows });
      expect((await getStats("org-1")).tickets).toMatchObject({ error_rate: 0, success_rate: 0 });
    });
});
