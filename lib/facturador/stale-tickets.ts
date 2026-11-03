import { sql } from "drizzle-orm";

import { refundTicketCredit } from "@/lib/credits";
import { db } from "@/lib/db";
import { publicTicketError } from "@/lib/facturador/public-errors";
import { ticketProviderResponseView, ticketWebhookRequestMetadata } from "@/lib/facturador/responses";
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch";

/**
 * Documented SLA: a ticket that does not advance out of received, queued or
 * processing within this time is closed as failed. Tickets already accepted by
 * the invoicing service (pending) keep their own 24-hour PROVIDER_TIMEOUT.
 */
export const STALE_TICKET_SLA_MS = Number(process.env.STALE_TICKET_SLA_MS ?? 30 * 60_000);
const SWEEP_BATCH = 50;

type SweptRow = {
  id: string;
  organization_id: string;
  idempotency_key: string | null;
  mode: "live" | "test";
  previous_status: string;
};

// Never sent: the purchase can be submitted again safely and the credit is returned.
const NEVER_SENT = {
  errorCode: "SERVICE_UNAVAILABLE",
  errorType: "unavailable",
  errorMessage: "Ticket was not processed within the documented time.",
};
// Sending started but never finished: the service may have received it.
const SEND_UNCONFIRMED = {
  errorCode: "UPSTREAM_UNAVAILABLE",
  errorType: "connection",
  errorMessage: "Ticket submission did not complete within the documented time.",
};

async function closeStale(input: {
  statuses: string[];
  referenceColumn: "updated_at" | "processing_started_at";
  error: typeof NEVER_SENT;
  cutoff: Date;
}): Promise<SweptRow[]> {
  const statuses = sql.join(input.statuses.map((status) => sql`${status}`), sql`, `);
  const reference = sql.raw(`coalesce(${input.referenceColumn}, updated_at)`);
  const result = await db.execute<SweptRow>(sql`
    with stale as (
      select id, status
      from ticket
      where status in (${statuses})
        and provider_request_id is null
        and ${reference} < ${input.cutoff}::timestamptz
      order by ${reference} asc
      limit ${SWEEP_BATCH}
      for update skip locked
    )
    update ticket
    set status = 'failed',
        status_rank = 100,
        error_code = ${input.error.errorCode}::text,
        error_type = ${input.error.errorType}::text,
        error_message = ${input.error.errorMessage}::text,
        upstream_raw = jsonb_build_object(
          'phase', 'stale_sweep',
          'previous_status', stale.status::text,
          'sla_minutes', ${Math.round(STALE_TICKET_SLA_MS / 60_000)}::int
        ),
        updated_at = now()
    from stale
    where ticket.id = stale.id
    returning ticket.id, ticket.organization_id, ticket.idempotency_key, ticket.mode, stale.status::text as previous_status
  `);
  return result.rows;
}

/** Close every ticket that exceeded the SLA, notify ticket.failed, and refund unsent ones. */
export async function sweepStaleTickets(now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_TICKET_SLA_MS);
  const neverSent = await closeStale({
    statuses: ["received", "queued"],
    referenceColumn: "updated_at",
    error: NEVER_SENT,
    cutoff,
  });
  const unconfirmed = await closeStale({
    statuses: ["processing"],
    referenceColumn: "processing_started_at",
    error: SEND_UNCONFIRMED,
    cutoff,
  });

  const notify = async (row: SweptRow, error: typeof NEVER_SENT) => {
    const publicError = publicTicketError({
      code: error.errorCode,
      type: error.errorType,
      message: error.errorMessage,
    });
    await db.execute(sql`
      update ticket
      set last_response = ${JSON.stringify(
        ticketProviderResponseView({
          ticketId: row.id,
          status: "failed",
          livemode: row.mode === "live",
          error: { code: error.errorCode, type: error.errorType, message: error.errorMessage },
        })
      )}::jsonb
      where id = ${row.id}
    `);
    if (error === NEVER_SENT && row.mode === "live") {
      await refundTicketCredit({
        organizationId: row.organization_id,
        ticketId: row.id,
        reason: "stale_ticket_never_sent",
      });
    }
    await dispatchOrganizationWebhookEvent(
      row.organization_id,
      "ticket.failed",
      { object: "ticket", id: row.id, status: "failed", error: publicError },
      ticketWebhookRequestMetadata({
        ticketId: row.id,
        idempotencyKey: row.idempotency_key,
        livemode: row.mode === "live",
      })
    );
  };

  const results = await Promise.allSettled([
    ...neverSent.map((row) => notify(row, NEVER_SENT)),
    ...unconfirmed.map((row) => notify(row, SEND_UNCONFIRMED)),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[stale-tickets] follow-up failed", result.reason);
  }
  if (neverSent.length || unconfirmed.length) {
    console.log(`[stale-tickets] closed never_sent=${neverSent.length} unconfirmed=${unconfirmed.length}`);
  }
  return { neverSent: neverSent.length, unconfirmed: unconfirmed.length };
}
