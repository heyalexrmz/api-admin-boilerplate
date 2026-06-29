"use server"

import { and, count, desc, eq } from "drizzle-orm"

import {
  requireActiveOrganization,
  requireOrganizationManager,
} from "@/app/lib/auth"
import type {
  DashboardDocument,
  DashboardInvoice,
  DashboardInvoiceDetail,
  DashboardTicket,
  DashboardTicketDetail,
} from "@/app/lib/definitions"
import { db } from "@/lib/db"
import {
  document,
  invoice,
  invoiceDocument,
  job,
  taxpayer,
  ticket,
  ticketDocument,
} from "@/lib/db/schema"
import {
  ticketFinalResponseView,
  ticketProviderResponseView,
} from "@/lib/facturador/responses"
import { createSignedDocumentUrl } from "@/lib/storage/document-links"

function toTicket(row: {
  id: string
  taxId: string
  status: string
  mode: "live" | "test"
  originalFileName: string | null
  providerRequestId: string | null
  errorCode: string | null
  errorMessage: string | null
  invoiceId: string | null
  invoiceUuid: string | null
  documentCount: number
  createdAt: Date
  updatedAt: Date
  finalizedAt: Date | null
}): DashboardTicket {
  return {
    id: row.id,
    taxId: row.taxId,
    status: row.status,
    livemode: row.mode === "live",
    originalFileName: row.originalFileName,
    providerRequestId: row.providerRequestId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    invoiceId: row.invoiceId,
    invoiceUuid: row.invoiceUuid,
    documentCount: Number(row.documentCount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
  }
}

function toDocument(row: typeof document.$inferSelect): DashboardDocument {
  return {
    id: row.id,
    kind: row.kind,
    originalFileName: row.originalFileName,
    contentType: row.contentType,
    bytes: row.bytes,
    url: createSignedDocumentUrl(row.id),
    createdAt: row.createdAt.toISOString(),
  }
}

function ticketErrorView(row: {
  errorCode: string | null
  errorType?: string | null
  errorMessage: string | null
}) {
  return row.errorCode || row.errorMessage
    ? {
        code: row.errorCode,
        type: row.errorType ?? null,
        message: row.errorMessage,
      }
    : null
}

export async function listDashboardTickets(): Promise<DashboardTicket[]> {
  const { organization } = await requireActiveOrganization()
  const rows = await db
    .select({
      id: ticket.id,
      taxId: taxpayer.rfc,
      status: ticket.status,
      mode: ticket.mode,
      originalFileName: ticket.originalFileName,
      providerRequestId: ticket.providerRequestId,
      errorCode: ticket.errorCode,
      errorMessage: ticket.errorMessage,
      invoiceId: invoice.id,
      invoiceUuid: invoice.satUuid,
      documentCount: count(document.id),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      finalizedAt: ticket.finalizedAt,
    })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .leftJoin(invoice, eq(invoice.ticketId, ticket.id))
    .leftJoin(ticketDocument, eq(ticketDocument.ticketId, ticket.id))
    .leftJoin(document, eq(document.id, ticketDocument.documentId))
    .where(eq(ticket.organizationId, organization.id))
    .groupBy(ticket.id, taxpayer.rfc, invoice.id, invoice.satUuid)
    .orderBy(desc(ticket.createdAt))
    .limit(300)

  return rows.map(toTicket)
}

export async function listDashboardInvoices(): Promise<DashboardInvoice[]> {
  const { organization } = await requireActiveOrganization()
  const rows = await db
    .select({
      id: invoice.id,
      ticketId: invoice.ticketId,
      taxId: taxpayer.rfc,
      status: invoice.status,
      uuid: invoice.satUuid,
      series: invoice.series,
      folio: invoice.folio,
      issuerTaxpayer: invoice.issuerTaxpayer,
      issuerRfc: invoice.issuerRfc,
      total: invoice.total,
      invoiceDate: invoice.invoiceDate,
      documentCount: count(document.id),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    })
    .from(invoice)
    .innerJoin(taxpayer, eq(taxpayer.id, invoice.taxpayerId))
    .leftJoin(invoiceDocument, eq(invoiceDocument.invoiceId, invoice.id))
    .leftJoin(document, eq(document.id, invoiceDocument.documentId))
    .where(eq(invoice.organizationId, organization.id))
    .groupBy(invoice.id, taxpayer.rfc)
    .orderBy(desc(invoice.createdAt))
    .limit(300)

  return rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    taxId: row.taxId,
    status: row.status,
    uuid: row.uuid,
    series: row.series,
    folio: row.folio,
    issuerTaxpayer: row.issuerTaxpayer,
    issuerRfc: row.issuerRfc,
    total: row.total,
    invoiceDate: row.invoiceDate?.toISOString() ?? null,
    documentCount: Number(row.documentCount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function getDashboardTicketDetail(
  id: string
): Promise<DashboardTicketDetail | null> {
  const { organization } = await requireActiveOrganization()
  const [row] = await db
    .select({
      id: ticket.id,
      taxId: taxpayer.rfc,
      status: ticket.status,
      mode: ticket.mode,
      originalFileName: ticket.originalFileName,
      providerRequestId: ticket.providerRequestId,
      errorCode: ticket.errorCode,
      errorMessage: ticket.errorMessage,
      invoiceId: invoice.id,
      invoiceUuid: invoice.satUuid,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      finalizedAt: ticket.finalizedAt,
      submitRequest: ticket.submitRequest,
      lastResponse: ticket.lastResponse,
      upstreamRaw: ticket.upstreamRaw,
      invoiceStatus: invoice.status,
      invoiceSeries: invoice.series,
      invoiceFolio: invoice.folio,
      invoiceIssuerTaxpayer: invoice.issuerTaxpayer,
      invoiceIssuerRfc: invoice.issuerRfc,
      invoiceTotal: invoice.total,
      invoiceDate: invoice.invoiceDate,
      invoiceCreatedAt: invoice.createdAt,
      invoiceUpdatedAt: invoice.updatedAt,
    })
    .from(ticket)
    .innerJoin(taxpayer, eq(taxpayer.id, ticket.taxpayerId))
    .leftJoin(invoice, eq(invoice.ticketId, ticket.id))
    .where(and(eq(ticket.id, id), eq(ticket.organizationId, organization.id)))
    .limit(1)

  if (!row) return null

  const docs = await db
    .select({ document })
    .from(ticketDocument)
    .innerJoin(document, eq(document.id, ticketDocument.documentId))
    .where(eq(ticketDocument.ticketId, id))

  const invoiceDetail = row.invoiceId
    ? {
        id: row.invoiceId,
        ticketId: row.id,
        taxId: row.taxId,
        status: row.invoiceStatus ?? "pending",
        uuid: row.invoiceUuid,
        series: row.invoiceSeries,
        folio: row.invoiceFolio,
        issuerTaxpayer: row.invoiceIssuerTaxpayer,
        issuerRfc: row.invoiceIssuerRfc,
        total: row.invoiceTotal,
        invoiceDate: row.invoiceDate?.toISOString() ?? null,
        documentCount: 0,
        createdAt: row.invoiceCreatedAt?.toISOString() ?? row.createdAt.toISOString(),
        updatedAt: row.invoiceUpdatedAt?.toISOString() ?? row.updatedAt.toISOString(),
      }
    : null

  return {
    ...toTicket({ ...row, documentCount: docs.length }),
    submitRequest: row.submitRequest,
    lastResponse: ticketProviderResponseView({
      ticketId: row.id,
      status: row.status as Parameters<typeof ticketProviderResponseView>[0]["status"],
      livemode: row.mode === "live",
      error: ticketErrorView(row),
    }),
    upstreamRaw: ticketFinalResponseView({
      ticketId: row.id,
      status: row.status as Parameters<typeof ticketFinalResponseView>[0]["status"],
      livemode: row.mode === "live",
      invoiceId: row.invoiceId,
      invoiceUuid: row.invoiceUuid,
      error: ticketErrorView(row),
    }),
    documents: docs.map((doc) => toDocument(doc.document)),
    invoice: invoiceDetail,
  }
}

export async function getDashboardInvoiceDetail(
  id: string
): Promise<DashboardInvoiceDetail | null> {
  const { organization } = await requireActiveOrganization()
  const [row] = await db
    .select({
      id: invoice.id,
      ticketId: invoice.ticketId,
      taxId: taxpayer.rfc,
      status: invoice.status,
      uuid: invoice.satUuid,
      series: invoice.series,
      folio: invoice.folio,
      issuerTaxpayer: invoice.issuerTaxpayer,
      issuerRfc: invoice.issuerRfc,
      total: invoice.total,
      invoiceDate: invoice.invoiceDate,
      metadata: invoice.metadata,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    })
    .from(invoice)
    .innerJoin(taxpayer, eq(taxpayer.id, invoice.taxpayerId))
    .where(and(eq(invoice.id, id), eq(invoice.organizationId, organization.id)))
    .limit(1)

  if (!row) return null

  const docs = await db
    .select({ document })
    .from(invoiceDocument)
    .innerJoin(document, eq(document.id, invoiceDocument.documentId))
    .where(eq(invoiceDocument.invoiceId, id))

  return {
    id: row.id,
    ticketId: row.ticketId,
    taxId: row.taxId,
    status: row.status,
    uuid: row.uuid,
    series: row.series,
    folio: row.folio,
    issuerTaxpayer: row.issuerTaxpayer,
    issuerRfc: row.issuerRfc,
    total: row.total,
    invoiceDate: row.invoiceDate?.toISOString() ?? null,
    metadata: row.metadata,
    documentCount: docs.length,
    documents: docs.map((doc) => toDocument(doc.document)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function refreshDashboardTicket(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { organization } = await requireOrganizationManager()
  const [row] = await db
    .select({ id: ticket.id })
    .from(ticket)
    .where(and(eq(ticket.id, id), eq(ticket.organizationId, organization.id)))
    .limit(1)
  if (!row) return { error: "Ticket not found." }
  await db
    .insert(job)
    .values({
      organizationId: organization.id,
      type: "refresh_ticket",
      payload: { ticketId: id },
      idempotencyKey: `refresh_ticket:${id}`,
    })
    .onConflictDoNothing()
  return { success: true }
}

export async function redeliverDashboardTicket(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { organization } = await requireOrganizationManager()
  const [row] = await db
    .select({ id: ticket.id })
    .from(ticket)
    .where(and(eq(ticket.id, id), eq(ticket.organizationId, organization.id)))
    .limit(1)
  if (!row) return { error: "Ticket not found." }
  await db
    .insert(job)
    .values({
      organizationId: organization.id,
      type: "redeliver_ticket",
      payload: { ticketId: id, destinationId: null },
      idempotencyKey: `redeliver_ticket:${id}:all`,
    })
    .onConflictDoNothing()
  return { success: true }
}
