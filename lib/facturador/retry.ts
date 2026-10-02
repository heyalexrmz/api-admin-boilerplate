import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoice, job, ticket } from "@/lib/db/schema";
import { canRetryTicketSubmission } from "./retry-eligibility";
import { ticketProviderResponseView } from "./responses";

export async function retryTicketSubmission(input: {
  organizationId: string;
  ticketId: string;
  userId: string;
}): Promise<{ success: true } | { error: string }> {
  return db.transaction(async (tx) => {
    // Serialize clicks across tabs/users before checking and changing the state.
    const [row] = await tx.select().from(ticket).where(and(
      eq(ticket.id, input.ticketId),
      eq(ticket.organizationId, input.organizationId),
    )).for("update");
    if (!row) return { error: "No encontramos el ticket." };

    const [existingInvoice] = await tx.select({ id: invoice.id }).from(invoice)
      .where(eq(invoice.ticketId, row.id)).limit(1);
    if (!canRetryTicketSubmission({ ...row, invoiceId: existingInvoice?.id ?? null })) {
      return { error: "Solo se pueden reintentar envíos fallidos sin confirmación de recepción ni factura." };
    }

    const [activeJob] = await tx.select({ id: job.id }).from(job).where(and(
      eq(job.organizationId, input.organizationId),
      eq(job.type, "submit_ticket"),
      sql`${job.payload}->>'ticketId' = ${row.id}`,
      inArray(job.status, ["pending", "running"]),
    )).limit(1);
    if (activeJob) return { error: "El intento anterior sigue en curso. Espera unos segundos y vuelve a intentarlo." };

    const jobId = randomUUID();
    await tx.insert(job).values({
      id: jobId,
      organizationId: input.organizationId,
      type: "submit_ticket",
      payload: {
        ticketId: row.id,
        retriedBy: input.userId,
        previousFailure: {
          errorCode: row.errorCode,
          errorType: row.errorType,
          errorMessage: row.errorMessage,
          upstreamRaw: row.upstreamRaw,
        },
      },
      idempotencyKey: `submit_ticket:${row.id}:retry:${jobId}`,
    });
    // Reuse the paid ticket, documents and provider idempotency key. Each manual
    // retry gets its own queue job, retaining the previous failure for diagnosis.
    await tx.update(ticket).set({
      status: "received",
      statusRank: 0,
      errorCode: null,
      errorType: null,
      errorMessage: null,
      upstreamRaw: null,
      lastResponse: ticketProviderResponseView({
        ticketId: row.id, status: "received", livemode: row.mode === "live",
      }),
      processingStartedAt: null,
      finalizedAt: null,
      updatedAt: new Date(),
    }).where(eq(ticket.id, row.id));

    return { success: true };
  });
}
