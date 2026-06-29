"use client"

import { ExternalLink } from "lucide-react"

import type { DashboardInvoiceDetail } from "@/app/lib/definitions"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function metadataRows(invoice: DashboardInvoiceDetail) {
  return [
    ["SAT UUID", invoice.uuid],
    ["Series", invoice.series],
    ["Folio", invoice.folio],
    ["RFC", invoice.taxId],
    ["Issuer", invoice.issuerTaxpayer],
    ["Issuer RFC", invoice.issuerRfc],
    ["Total", invoice.total],
    ["Invoice date", invoice.invoiceDate],
    ["Ticket ID", invoice.ticketId],
  ]
}

function JsonBlock({ value }: { value: unknown }) {
  if (!value) return <p className="text-sm text-muted-foreground">No response payload</p>
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: DashboardInvoiceDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden sm:max-w-[min(96vw,86rem)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Invoice detail
            {invoice && <Badge>{invoice.status}</Badge>}
          </SheetTitle>
          <SheetDescription className="font-mono">
            {invoice?.uuid ?? invoice?.id ?? "Loading..."}
          </SheetDescription>
        </SheetHeader>

        {invoice && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Accordion
              type="multiple"
              defaultValue={["metadata", "documents", "response"]}
              className="rounded-xl border px-4"
            >
              <AccordionItem value="metadata">
                <AccordionTrigger>Invoice metadata</AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metadataRows(invoice).map(([label, value]) => (
                        <TableRow key={label}>
                          <TableCell className="text-muted-foreground">{label}</TableCell>
                          <TableCell className="whitespace-normal break-all font-mono text-xs">{value ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="documents">
                <AccordionTrigger>Documents</AccordionTrigger>
                <AccordionContent>
                  {invoice.documents.length > 0 ? (
                    <div className="grid gap-2">
                      {invoice.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.originalFileName}</p>
                            <p className="text-xs text-muted-foreground">{doc.kind} · {doc.contentType}</p>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <a href={doc.url} target="_blank" rel="noreferrer">
                              <ExternalLink />
                              Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No invoice documents found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="response">
                <AccordionTrigger>Response</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={invoice.metadata} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
