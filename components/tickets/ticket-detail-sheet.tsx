"use client"

import { Download } from "lucide-react"

import type { DashboardTicketDetail } from "@/app/lib/definitions"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function JsonBlock({ value }: { value: unknown }) {
  if (!value) return <p className="text-sm text-muted-foreground">Sin datos</p>
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  )
}

function invoiceMetadataRows(ticket: DashboardTicketDetail) {
  return ticket.invoice
    ? [
        ["SAT UUID", ticket.invoice.uuid],
        ["Serie", ticket.invoice.series],
        ["Folio", ticket.invoice.folio],
        ["RFC", ticket.invoice.taxId],
        ["Emisor", ticket.invoice.issuerTaxpayer],
        ["RFC emisor", ticket.invoice.issuerRfc],
        ["Total", ticket.invoice.total],
        ["Fecha de factura", ticket.invoice.invoiceDate],
        ["Ticket ID", ticket.id],
      ]
    : []
}

function sameOriginUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

export function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: DashboardTicketDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const image = ticket?.documents.find((doc) => doc.kind === "ticket_image")
  const defaultAccordion = ticket?.invoice
    ? ["image", "invoice", "documents", "request", "response"]
    : ["image", "documents", "request", "response"]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden sm:max-w-[min(96vw,86rem)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Detalle del ticket
            {ticket && <Badge variant={ticket.livemode ? "outline" : "secondary"}>{ticket.livemode ? "Producción" : "Sandbox"}</Badge>}
          </SheetTitle>
          <SheetDescription className="font-mono">
            {ticket?.id ?? "Cargando..."}
          </SheetDescription>
        </SheetHeader>

        {ticket && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="RFC" value={<span className="font-mono">{ticket.taxId}</span>} />
              <Detail label="Estado" value={<StatusBadge status={ticket.status} />} />
              <Detail label="Factura" value={ticket.invoice?.uuid ?? ticket.invoiceId ?? "—"} />
            </div>

            <Accordion
              type="multiple"
              defaultValue={defaultAccordion}
              className="mt-4 rounded-xl border px-4"
            >
              <AccordionItem value="image">
                <AccordionTrigger>Imagen del ticket</AccordionTrigger>
                <AccordionContent>
                  {image ? (
                    <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sameOriginUrl(image.url)}
                        alt={image.originalFileName}
                        className="max-h-[34rem] max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No encontramos imagen del ticket.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {ticket.invoice && (
                <AccordionItem value="invoice">
                  <AccordionTrigger>Datos de la factura</AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceMetadataRows(ticket).map(([label, value]) => (
                          <TableRow key={label}>
                            <TableCell className="text-muted-foreground">{label}</TableCell>
                            <TableCell className="whitespace-normal break-all font-mono text-xs">
                              {value ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="documents">
                <AccordionTrigger>Documentos</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-2">
                    {ticket.documents.map((doc) => (
                      <div key={doc.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-medium">{doc.originalFileName}</p>
                          <p className="text-xs text-muted-foreground">{doc.kind} · {doc.contentType}</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                          <a href={doc.url} download>
                            <Download />
                            Descargar archivo
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="request">
                <AccordionTrigger>Solicitud</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={ticket.submitRequest} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="response">
                <AccordionTrigger>Respuesta</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={ticket.lastResponse} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="final-response">
                <AccordionTrigger>Respuesta final</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={ticket.upstreamRaw} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
