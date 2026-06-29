import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";

import { ApiError } from "@/lib/api-contracts";
import { debitTicketCredit, getCreditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import {
  document,
  idempotencyRecord,
  invoice,
  invoiceDocument,
  job,
  taxpayer,
  ticket,
  ticketDocument,
  usageCounter,
  webhookEventLog,
} from "@/lib/db/schema";
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch";
import {
  classifyTocinoEvent,
  downloadTocinoAsset,
  extractTocinoInvoice,
  mapTocinoError,
  submitToTocino,
  type TocinoError,
} from "@/lib/facturador/tocino";
import {
  createSignedDocumentUrl,
} from "@/lib/storage/document-links";
import { ticketProviderResponseView } from "@/lib/facturador/responses";
import {
  documentObjectKey,
  getS3StorageConfig,
  S3DocumentStore,
} from "@/lib/storage/s3";

const IMAGE_TYPES = new Map([
  ["ffd8ff", "image/jpeg"],
  ["89504e47", "image/png"],
]);
const MAX_TICKET_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TICKET_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_TICKET_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

function periodFor(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeRfc(rfc: string): string {
  return rfc.trim().toUpperCase();
}

function detectContentType(buffer: Buffer, fallback: string | null): string | null {
  const hex = buffer.subarray(0, 4).toString("hex");
  for (const [prefix, contentType] of IMAGE_TYPES.entries()) {
    if (hex.startsWith(prefix)) return contentType;
  }
  if (buffer.subarray(0, 4).toString("utf8") === "%PDF") return "application/pdf";
  const textStart = buffer.subarray(0, 80).toString("utf8").trimStart();
  if (textStart.startsWith("<?xml") || textStart.startsWith("<")) return "application/xml";
  return fallback;
}

function assertTicketImage(file: {
  buffer: Buffer;
  fileName: string;
  contentType: string | null;
}): string {
  if (file.buffer.byteLength > MAX_TICKET_IMAGE_BYTES) {
    throw new ApiError({
      status: 413,
      code: "file_too_large",
      type: "validation_error",
      message: "Ticket image must be 10 MB or smaller.",
      param: "file",
    });
  }

  const extension = file.fileName.includes(".")
    ? file.fileName.split(".").pop()?.toLowerCase()
    : null;
  if (extension && !ALLOWED_TICKET_IMAGE_EXTENSIONS.has(extension)) {
    throw new ApiError({
      status: 400,
      code: "invalid_file_type",
      type: "validation_error",
      message: "Ticket image must have a .jpg, .jpeg, or .png extension.",
      param: "file",
    });
  }

  if (file.contentType && !ALLOWED_TICKET_IMAGE_TYPES.has(file.contentType)) {
    throw new ApiError({
      status: 400,
      code: "invalid_file_type",
      type: "validation_error",
      message: "Ticket image content type must be image/jpeg or image/png.",
      param: "file",
    });
  }

  const contentType = detectContentType(file.buffer, null);
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    throw new ApiError({
      status: 400,
      code: "invalid_file_type",
      type: "validation_error",
      message: "Ticket image must be a JPEG or PNG file.",
      param: "file",
    });
  }
  return contentType;
}

function assertPdf(buffer: Buffer, param: string): string {
  const contentType = detectContentType(buffer, null);
  if (contentType !== "application/pdf") {
    throw new ApiError({
      status: 400,
      code: "invalid_file_type",
      type: "validation_error",
      message: `${param} must be a PDF file.`,
      param,
    });
  }
  return contentType;
}

async function fileBuffer(value: FormDataEntryValue | null, param: string): Promise<{
  buffer: Buffer;
  fileName: string;
  contentType: string | null;
}> {
  if (!(value instanceof File)) {
    throw new ApiError({
      status: 400,
      code: "missing_file",
      type: "validation_error",
      message: `${param} is required.`,
      param,
    });
  }

  return {
    buffer: Buffer.from(await value.arrayBuffer()),
    fileName: value.name || param,
    contentType: value.type || null,
  };
}

async function ensureTaxpayer(input: {
  organizationId: string;
  rfc: string;
}) {
  const rfc = normalizeRfc(input.rfc);
  if (!rfc) {
    throw new ApiError({
      status: 400,
      code: "tax_id_required",
      type: "validation_error",
      message: "tax_id is required.",
      param: "tax_id",
    });
  }

  const [row] = await db
    .insert(taxpayer)
    .values({
      organizationId: input.organizationId,
      rfc,
      displayName: rfc,
    })
    .onConflictDoUpdate({
      target: [taxpayer.organizationId, taxpayer.rfc],
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!row) throw new Error("Could not create taxpayer.");
  return row;
}

export function documentView(row: typeof document.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    content_type: row.contentType,
    bytes: row.bytes,
    url: createSignedDocumentUrl(row.id),
    created_at: row.createdAt.toISOString(),
  };
}

export async function storeDocument(input: {
  organizationId: string;
  taxpayerId: string | null;
  rfc: string;
  ticketId: string;
  kind: typeof document.$inferInsert.kind;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}) {
  const id = randomUUID();
  const bucket = getS3StorageConfig().bucket;
  const key = documentObjectKey({
    organizationId: input.organizationId,
    rfc: input.rfc,
    ticketId: input.ticketId,
    documentId: id,
    fileName: input.fileName,
  });

  await new S3DocumentStore().put({
    key,
    body: input.buffer,
    contentType: input.contentType,
  });

  const [row] = await db
    .insert(document)
    .values({
      id,
      organizationId: input.organizationId,
      taxpayerId: input.taxpayerId,
      kind: input.kind,
      status: "stored",
      originalFileName: input.fileName,
      contentType: input.contentType,
      bytes: input.buffer.byteLength,
      checksumSha256: sha256(input.buffer),
      storageBucket: bucket,
      storageKey: key,
    })
    .returning();

  if (!row) throw new Error("Could not store document metadata.");
  return row;
}

function collectSubmitFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    fields[key] = String(value);
  }
  return fields;
}

function tocinoErrorToTicket(error: TocinoError) {
  return {
    errorCode: error.code,
    errorType: error.category,
    errorMessage: error.message,
  };
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function incrementUsage(
  organizationId: string,
  metric: typeof usageCounter.$inferInsert.metric,
  amount = 1
) {
  await db
    .insert(usageCounter)
    .values({
      organizationId,
      period: periodFor(),
      metric,
      count: amount,
    })
    .onConflictDoUpdate({
      target: [usageCounter.organizationId, usageCounter.period, usageCounter.metric],
      set: {
        count: sql`${usageCounter.count} + ${amount}`,
        updatedAt: new Date(),
      },
    });
}

export function ticketView(input: {
  ticket: typeof ticket.$inferSelect;
  taxpayerRfc?: string | null;
  documents?: (typeof document.$inferSelect)[];
  invoice?: typeof invoice.$inferSelect | null;
}) {
  return {
    object: "ticket",
    id: input.ticket.id,
    tax_id: input.taxpayerRfc ?? null,
    status: input.ticket.status,
    livemode: input.ticket.mode === "live",
    created_at: input.ticket.createdAt.toISOString(),
    updated_at: input.ticket.updatedAt.toISOString(),
    finalized_at: input.ticket.finalizedAt?.toISOString() ?? null,
    error: input.ticket.errorCode
      ? {
          code: input.ticket.errorCode,
          type: input.ticket.errorType,
          message: input.ticket.errorMessage,
        }
      : null,
    invoice: input.invoice
      ? {
          id: input.invoice.id,
          status: input.invoice.status,
          uuid: input.invoice.satUuid,
          series: input.invoice.series,
          folio: input.invoice.folio,
          total: input.invoice.total,
          invoice_date: input.invoice.invoiceDate?.toISOString() ?? null,
        }
      : null,
    documents: (input.documents ?? []).map(documentView),
  };
}

function ticketReceivedView(input: {
  ticket: typeof ticket.$inferSelect;
  taxpayerRfc: string;
}) {
  return {
    object: "ticket",
    id: input.ticket.id,
    tax_id: input.taxpayerRfc,
    status: input.ticket.status,
    livemode: input.ticket.mode === "live",
    created_at: input.ticket.createdAt.toISOString(),
  };
}

async function documentsForTicket(ticketId: string) {
  const rows = await db
    .select({ document })
    .from(ticketDocument)
    .innerJoin(document, eq(document.id, ticketDocument.documentId))
    .where(eq(ticketDocument.ticketId, ticketId));
  return rows.map((row) => row.document);
}

export async function createTicketFromFormData(input: {
  organizationId: string;
  apiKeyId: string;
  mode: "live" | "test";
  requestId: string;
  formData: FormData;
  defer?: (task: () => Promise<void>) => void;
}) {
  const taxId = String(input.formData.get("tax_id") ?? "");
  const submitFields = collectSubmitFields(input.formData);
  const taxpayerRow = await ensureTaxpayer({
    organizationId: input.organizationId,
    rfc: taxId,
  });

  const ticketFile = await fileBuffer(input.formData.get("file"), "file");
  const ticketContentType = assertTicketImage(ticketFile);
  const csfFile = input.formData.get("csf_pdf")
    ? await fileBuffer(input.formData.get("csf_pdf"), "csf_pdf")
    : null;
  const csfContentType = csfFile ? assertPdf(csfFile.buffer, "csf_pdf") : null;
  const ticketId = randomUUID();
  const idempotencyKey = randomUUID();

  if (input.mode === "live") {
    await debitTicketCredit({
      organizationId: input.organizationId,
      ticketId,
      requestId: input.requestId,
    });
  }

  const [ticketRow] = await db
    .insert(ticket)
    .values({
      id: ticketId,
      organizationId: input.organizationId,
      taxpayerId: taxpayerRow.id,
      idempotencyKey,
      mode: input.mode,
      status: "received",
      originalFileName: ticketFile.fileName,
      submitRequest: {
        ...submitFields,
        file: "<base64 omitted>",
        ...(csfFile ? { csf_pdf: "<base64 omitted>" } : {}),
      },
    })
    .returning();
  if (!ticketRow) throw new Error("Could not create ticket.");

  const response = ticketReceivedView({
    ticket: ticketRow,
    taxpayerRfc: taxpayerRow.rfc,
  });

  await db
    .insert(idempotencyRecord)
    .values({
      organizationId: input.organizationId,
      idempotencyKey,
      requestFingerprint: sha256(ticketId),
      responseStatus: 201,
      responseBody: response,
    })
    .onConflictDoNothing();

  dispatchOrganizationWebhookEvent(
    input.organizationId,
    "ticket.created",
    response,
    {
      id: input.requestId,
      idempotencyKey,
      livemode: input.mode === "live",
    }
  ).catch((error) => console.error("[facturador] ticket.created webhook failed", error));

  const finishIntake = async () => {
    try {
      const imageDocument = await storeDocument({
        organizationId: input.organizationId,
        taxpayerId: taxpayerRow.id,
        rfc: taxpayerRow.rfc,
        ticketId,
        kind: "ticket_image",
        fileName: ticketFile.fileName,
        contentType: ticketContentType,
        buffer: ticketFile.buffer,
      });
      await db.insert(ticketDocument).values({
        ticketId,
        documentId: imageDocument.id,
        role: "ticket_image",
      });

      if (csfFile && csfContentType) {
        const csfDocument = await storeDocument({
          organizationId: input.organizationId,
          taxpayerId: taxpayerRow.id,
          rfc: taxpayerRow.rfc,
          ticketId,
          kind: "csf_pdf",
          fileName: csfFile.fileName,
          contentType: csfContentType,
          buffer: csfFile.buffer,
        });
        await db.insert(ticketDocument).values({
          ticketId,
          documentId: csfDocument.id,
          role: "csf_pdf",
        });
      }

      if (input.mode === "live") {
        await db.insert(job).values({
          organizationId: input.organizationId,
          type: "submit_ticket",
          payload: { ticketId },
          idempotencyKey: `submit_ticket:${ticketId}`,
        });
        await incrementUsage(input.organizationId, "tickets_submitted");
        await incrementUsage(input.organizationId, "documents_stored", csfFile ? 2 : 1);
      } else {
        await finalizeTicketWithMockProvider({
          organizationId: input.organizationId,
          ticketId,
        });
      }
    } catch (error) {
      console.error(`[facturador] post-response intake failed for ticket=${ticketId}`, error);
      await db
        .update(ticket)
        .set({
          status: "failed",
          statusRank: 100,
          errorCode: "INTAKE_FAILED",
          errorType: "internal",
          errorMessage:
            error instanceof Error ? error.message : "Ticket intake failed.",
          updatedAt: new Date(),
        })
        .where(eq(ticket.id, ticketId));
    }
  };

  if (input.defer) {
    input.defer(finishIntake);
  } else {
    await finishIntake();
  }

  return response;
}

export async function getTicket(organizationId: string, id: string) {
  const [row] = await db
    .select({ ticket, taxpayer, invoice })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .leftJoin(invoice, eq(invoice.ticketId, ticket.id))
    .where(and(eq(ticket.organizationId, organizationId), eq(ticket.id, id)));
  if (!row) return null;
  return ticketView({
    ticket: row.ticket,
    taxpayerRfc: row.taxpayer.rfc,
    invoice: row.invoice,
    documents: await documentsForTicket(id),
  });
}

export async function listTickets(input: {
  organizationId: string;
  limit?: number;
  status?: string | null;
}) {
  const conditions = [eq(ticket.organizationId, input.organizationId)];
  if (input.status) conditions.push(eq(ticket.status, input.status as typeof ticket.$inferSelect.status));

  const rows = await db
    .select({ ticket, taxpayer })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .where(and(...conditions))
    .orderBy(desc(ticket.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 200));

  return rows.map((row) =>
    ticketView({ ticket: row.ticket, taxpayerRfc: row.taxpayer.rfc })
  );
}

export async function enqueueTicketJob(input: {
  organizationId: string;
  ticketId: string;
  type: "refresh_ticket" | "redeliver_ticket";
  destinationId?: string | null;
}) {
  await db.insert(job).values({
    organizationId: input.organizationId,
    type: input.type,
    payload: {
      ticketId: input.ticketId,
      destinationId: input.destinationId ?? null,
    },
    idempotencyKey: `${input.type}:${input.ticketId}:${input.destinationId ?? "all"}`,
  }).onConflictDoNothing();
}

export async function getStats(organizationId: string, days = 30) {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
  const result = await db.execute<{
    status: string;
    count: number;
  }>(sql`
    select status, count(*)::int as count
    from ticket
    where organization_id = ${organizationId}
      and created_at >= ${since}
    group by status
  `);

  const total = result.rows.reduce((sum, row) => sum + row.count, 0);
  const failed = result.rows
    .filter((row) => row.status === "failed")
    .reduce((sum, row) => sum + row.count, 0);

  return {
    object: "stats",
    window_days: days,
    tickets: {
      total,
      by_status: Object.fromEntries(result.rows.map((row) => [row.status, row.count])),
      error_rate: total > 0 ? failed / total : 0,
    },
  };
}

export async function getUsage(organizationId: string) {
  const [rows, creditBalance] = await Promise.all([
    db
      .select()
      .from(usageCounter)
      .where(
        and(eq(usageCounter.organizationId, organizationId), eq(usageCounter.period, periodFor()))
      ),
    getCreditBalance(organizationId),
  ]);

  return {
    object: "usage",
    period: periodFor(),
    metrics: Object.fromEntries(rows.map((row) => [row.metric, row.count])),
    plan: creditBalance.plan,
    credits: creditBalance.credits,
  };
}

export async function listDeliveries(organizationId: string) {
  const rows = await db
    .select()
    .from(webhookEventLog)
    .where(eq(webhookEventLog.organizationId, organizationId))
    .orderBy(desc(webhookEventLog.createdAt))
    .limit(200);
  return rows.map((row) => ({
    object: "delivery",
    id: row.id,
    event_id: row.eventId,
    event_type: row.eventType,
    status: row.status,
    http_status: row.httpStatus,
    attempts: row.attemptCount,
    created_at: row.createdAt.toISOString(),
    delivered_at: row.deliveredAt?.toISOString() ?? null,
  }));
}

export async function submitTicketToTocino(input: {
  organizationId: string;
  ticketId: string;
}) {
  const [row] = await db
    .select({ ticket, taxpayer })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .where(and(eq(ticket.organizationId, input.organizationId), eq(ticket.id, input.ticketId)));
  if (!row) throw new Error(`Ticket not found: ${input.ticketId}`);
  if (row.ticket.status !== "received") return;
  if (row.ticket.mode === "test") {
    await finalizeTicketWithMockProvider(input);
    return { outcome: "sandbox_finalized" as const };
  }

  const docs = await documentsForTicket(row.ticket.id);
  const image = docs.find((doc) => doc.kind === "ticket_image");
  if (!image) {
    await db
      .update(ticket)
      .set({
        status: "failed",
        statusRank: 100,
        errorCode: "IMAGE_MISSING",
        errorType: "validation",
        errorMessage: "Ticket image not found in storage.",
        updatedAt: new Date(),
      })
      .where(eq(ticket.id, row.ticket.id));
    return {
      outcome: "tocino_failed" as const,
      errorCode: "IMAGE_MISSING",
      errorMessage: "Ticket image not found in storage.",
    };
  }

  const store = new S3DocumentStore();
  const imageBase64 = (await store.getBuffer(image.storageKey)).toString("base64");
  const csf = docs.find((doc) => doc.kind === "csf_pdf");
  const csfBase64 = csf ? (await store.getBuffer(csf.storageKey)).toString("base64") : undefined;
  const storedFields =
    row.ticket.submitRequest && typeof row.ticket.submitRequest === "object"
      ? (row.ticket.submitRequest as Record<string, unknown>)
      : {};
  const body = {
    ...storedFields,
    country:
      typeof storedFields.country === "string" && storedFields.country.trim()
        ? storedFields.country
        : "México",
    file: imageBase64,
    file_name: row.ticket.originalFileName ?? image.originalFileName,
    ...(csfBase64 ? { csf_pdf: csfBase64 } : {}),
  };
  const redactedSubmitRequest = {
    ...body,
    file: `<base64 omitted: ${imageBase64.length} chars>`,
    ...(csfBase64 ? { csf_pdf: `<base64 omitted: ${csfBase64.length} chars>` } : {}),
  };

  await db
    .update(ticket)
    .set({
      status: "processing",
      statusRank: 50,
      processingStartedAt: new Date(),
      submitRequest: redactedSubmitRequest,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, row.ticket.id));

  await dispatchOrganizationWebhookEvent(
    input.organizationId,
    "ticket.processing",
    { object: "ticket", id: row.ticket.id, status: "processing" },
    { livemode: true }
  );

  const result = await submitToTocino({
    idempotencyKey: row.ticket.idempotencyKey ?? row.ticket.id,
    body,
  });

  if (result.ok) {
    const normalizedResponse = ticketProviderResponseView({
      ticketId: row.ticket.id,
      status: "pending",
      livemode: true,
    });
    await db
      .update(ticket)
      .set({
        status: "pending",
        provider: result.provider,
        providerRequestId: result.novaRequestId,
        lastResponse: normalizedResponse,
        updatedAt: new Date(),
      })
      .where(eq(ticket.id, row.ticket.id));
    return {
      outcome: "tocino_pending" as const,
      novaRequestId: result.novaRequestId,
      provider: result.provider,
    };
  }

  const mapped = tocinoErrorToTicket(result.error);
  const normalizedResponse = ticketProviderResponseView({
    ticketId: row.ticket.id,
    status: "failed",
    livemode: true,
    error: {
      code: mapped.errorCode,
      type: mapped.errorType,
      message: mapped.errorMessage,
    },
  });
  await db
    .update(ticket)
    .set({
      status: "failed",
      statusRank: 100,
      ...mapped,
      lastResponse: normalizedResponse,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, row.ticket.id));

  await dispatchOrganizationWebhookEvent(
    input.organizationId,
    "ticket.failed",
    {
      object: "ticket",
      id: row.ticket.id,
      status: "failed",
      error: {
        code: mapped.errorCode,
        type: mapped.errorType,
        message: mapped.errorMessage,
      },
    },
    { livemode: true }
  );

  return {
    outcome: "tocino_failed" as const,
    errorCode: mapped.errorCode,
    errorMessage: mapped.errorMessage,
  };
}

async function fetchInvoiceDocument(input: {
  url: string | null;
  fallbackBuffer?: Buffer;
  fallbackContentType: string;
}) {
  if (input.url) {
    return downloadTocinoAsset(input.url);
  }
  if (input.fallbackBuffer) {
    return { buffer: input.fallbackBuffer, contentType: input.fallbackContentType };
  }
  return null;
}

export async function applyTocinoWebhookEvent(raw: unknown) {
  const payload = raw as Record<string, unknown>;
  const idempotencyKey = payload.idempotency_key ? String(payload.idempotency_key) : null;
  const providerRequestId = payload.nova_request_id ? String(payload.nova_request_id) : null;

  const conditions = [];
  if (idempotencyKey) conditions.push(eq(ticket.idempotencyKey, idempotencyKey));
  if (providerRequestId) conditions.push(eq(ticket.providerRequestId, providerRequestId));
  if (conditions.length === 0) {
    throw new ApiError({
      status: 400,
      code: "invalid_payload",
      type: "validation_error",
      message: "Missing idempotency_key or nova_request_id.",
    });
  }

  const [row] = await db
    .select({ ticket, taxpayer })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .where(conditions.length === 1 ? conditions[0]! : or(...conditions))
    .limit(1);

  if (!row) return { ok: true, parked: true };

  const eventType = classifyTocinoEvent(raw);
  if (eventType === "ticket.failed") {
    const mapped = tocinoErrorToTicket(mapTocinoError("process", raw));
    await db
      .update(ticket)
      .set({
        status: "failed",
        statusRank: 100,
        ...mapped,
        upstreamRaw: raw,
        updatedAt: new Date(),
      })
      .where(eq(ticket.id, row.ticket.id));
    await dispatchOrganizationWebhookEvent(
      row.ticket.organizationId,
      "ticket.failed",
      {
        object: "ticket",
        id: row.ticket.id,
        status: "failed",
        error: {
          code: mapped.errorCode,
          type: mapped.errorType,
          message: mapped.errorMessage,
        },
      },
      { livemode: row.ticket.mode === "live" }
    );
    return { ok: true, parked: false };
  }

  const invoiceData = extractTocinoInvoice(raw);
  const invoiceDate = invoiceData.invoiceDate ? new Date(String(invoiceData.invoiceDate)) : null;
  const [invoiceRow] = await db
    .insert(invoice)
    .values({
      organizationId: row.ticket.organizationId,
      taxpayerId: row.taxpayer.id,
      ticketId: row.ticket.id,
      status: "finalized",
      satUuid: nullableString(invoiceData.satUuid),
      series: nullableString(invoiceData.series),
      folio: nullableString(invoiceData.folio),
      issuerTaxpayer: nullableString(invoiceData.issuerTaxpayer),
      issuerRfc: nullableString(invoiceData.issuerRfc),
      total: invoiceData.total ? String(invoiceData.total) : null,
      invoiceDate: invoiceDate && !Number.isNaN(invoiceDate.getTime()) ? invoiceDate : null,
      metadata: raw as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: invoice.ticketId,
      set: {
        status: "finalized",
        updatedAt: new Date(),
        metadata: raw as Record<string, unknown>,
      },
    })
    .returning();
  if (!invoiceRow) throw new Error("Could not record Tocino invoice.");

  const storedInvoiceDocuments: (typeof document.$inferSelect)[] = [];
  const xmlFallback = invoiceData.xmlData
    ? Buffer.from(JSON.stringify(invoiceData.xmlData))
    : undefined;
  const [xmlAsset, pdfAsset] = await Promise.all([
    fetchInvoiceDocument({
      url: nullableString(invoiceData.xmlUrl),
      fallbackBuffer: xmlFallback,
      fallbackContentType: "application/xml",
    }),
    fetchInvoiceDocument({
      url: nullableString(invoiceData.pdfUrl),
      fallbackContentType: "application/pdf",
    }),
  ]);

  if (xmlAsset) {
    const xmlDoc = await storeDocument({
      organizationId: row.ticket.organizationId,
      taxpayerId: row.taxpayer.id,
      rfc: row.taxpayer.rfc,
      ticketId: row.ticket.id,
      kind: "invoice_xml",
      fileName: `${invoiceRow.satUuid ?? row.ticket.id}.xml`,
      contentType: xmlAsset.contentType,
      buffer: xmlAsset.buffer,
    });
    await db
      .insert(invoiceDocument)
      .values({ invoiceId: invoiceRow.id, documentId: xmlDoc.id, role: "invoice_xml" })
      .onConflictDoNothing();
    storedInvoiceDocuments.push(xmlDoc);
  }

  if (pdfAsset) {
    const pdfDoc = await storeDocument({
      organizationId: row.ticket.organizationId,
      taxpayerId: row.taxpayer.id,
      rfc: row.taxpayer.rfc,
      ticketId: row.ticket.id,
      kind: "invoice_pdf",
      fileName: `${invoiceRow.satUuid ?? row.ticket.id}.pdf`,
      contentType: pdfAsset.contentType,
      buffer: pdfAsset.buffer,
    });
    await db
      .insert(invoiceDocument)
      .values({ invoiceId: invoiceRow.id, documentId: pdfDoc.id, role: "invoice_pdf" })
      .onConflictDoNothing();
    storedInvoiceDocuments.push(pdfDoc);
  }

  const [updatedTicket] = await db
    .update(ticket)
    .set({
      status: "finalized",
      statusRank: 100,
      upstreamRaw: raw,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, row.ticket.id))
    .returning();
  if (!updatedTicket) throw new Error("Could not finalize Tocino ticket.");

  const eventPayload = ticketView({
    ticket: updatedTicket,
    taxpayerRfc: row.taxpayer.rfc,
    invoice: invoiceRow,
    documents: [...(await documentsForTicket(row.ticket.id)), ...storedInvoiceDocuments],
  });

  await dispatchOrganizationWebhookEvent(
    row.ticket.organizationId,
    "invoice.finalized",
    { object: "invoice", id: invoiceRow.id, ticket_id: row.ticket.id },
    { livemode: row.ticket.mode === "live" }
  );
  await dispatchOrganizationWebhookEvent(
    row.ticket.organizationId,
    "ticket.finalized",
    eventPayload,
    { livemode: row.ticket.mode === "live" }
  );

  return { ok: true, parked: false };
}

export async function finalizeTicketWithMockProvider(input: {
  organizationId: string;
  ticketId: string;
}) {
  const [row] = await db
    .select({ ticket, taxpayer })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .where(and(eq(ticket.organizationId, input.organizationId), eq(ticket.id, input.ticketId)));
  if (!row) throw new Error(`Ticket not found: ${input.ticketId}`);
  if (row.ticket.status === "finalized") return;

  const processingAt = new Date();
  await db
    .update(ticket)
    .set({
      status: "processing",
      statusRank: 50,
      processingStartedAt: processingAt,
      updatedAt: processingAt,
    })
    .where(eq(ticket.id, row.ticket.id));

  await dispatchOrganizationWebhookEvent(
    input.organizationId,
    "ticket.processing",
    { object: "ticket", id: row.ticket.id, status: "processing" },
    { livemode: row.ticket.mode === "live" }
  );

  const now = new Date();
  const [invoiceRow] = await db
    .insert(invoice)
    .values({
      organizationId: input.organizationId,
      taxpayerId: row.taxpayer.id,
      ticketId: row.ticket.id,
      status: "finalized",
      satUuid: randomUUID().toUpperCase(),
      series: "SAND",
      folio: "000001",
      issuerTaxpayer: "Sandbox Merchant",
      issuerRfc: "XAXX010101000",
      total: "100.00",
      invoiceDate: now,
    })
    .onConflictDoUpdate({
      target: invoice.ticketId,
      set: { status: "finalized", updatedAt: now },
    })
    .returning();
  if (!invoiceRow) throw new Error("Could not create invoice.");

  const xml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?><Invoice uuid="${invoiceRow.satUuid}" total="100.00" />`
  );
  const pdf = Buffer.from("%PDF-1.4\n% Sandbox invoice PDF\n");
  const xmlDocument = await storeDocument({
    organizationId: input.organizationId,
    taxpayerId: row.taxpayer.id,
    rfc: row.taxpayer.rfc,
    ticketId: row.ticket.id,
    kind: "invoice_xml",
    fileName: `${invoiceRow.satUuid}.xml`,
    contentType: "application/xml",
    buffer: xml,
  });
  const pdfDocument = await storeDocument({
    organizationId: input.organizationId,
    taxpayerId: row.taxpayer.id,
    rfc: row.taxpayer.rfc,
    ticketId: row.ticket.id,
    kind: "invoice_pdf",
    fileName: `${invoiceRow.satUuid}.pdf`,
    contentType: "application/pdf",
    buffer: pdf,
  });

  await db.insert(invoiceDocument).values([
    { invoiceId: invoiceRow.id, documentId: xmlDocument.id, role: "invoice_xml" },
    { invoiceId: invoiceRow.id, documentId: pdfDocument.id, role: "invoice_pdf" },
  ]).onConflictDoNothing();

  const finalizedAt = new Date();
  const [updatedTicket] = await db
    .update(ticket)
    .set({
      status: "finalized",
      statusRank: 100,
      finalizedAt,
      updatedAt: finalizedAt,
    })
    .where(eq(ticket.id, row.ticket.id))
    .returning();
  if (!updatedTicket) throw new Error("Could not finalize ticket.");

  const payload = ticketView({
    ticket: updatedTicket,
    taxpayerRfc: row.taxpayer.rfc,
    invoice: invoiceRow,
    documents: [...(await documentsForTicket(row.ticket.id)), xmlDocument, pdfDocument],
  });

  await dispatchOrganizationWebhookEvent(
    input.organizationId,
    "invoice.finalized",
    { object: "invoice", id: invoiceRow.id, ticket_id: row.ticket.id },
    { livemode: row.ticket.mode === "live" }
  );
  await dispatchOrganizationWebhookEvent(
    input.organizationId,
    "ticket.finalized",
    payload,
    { livemode: row.ticket.mode === "live" }
  );
}
