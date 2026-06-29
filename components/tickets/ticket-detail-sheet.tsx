"use client"

import { ExternalLink } from "lucide-react"

import type { DashboardTicketDetail } from "@/app/lib/definitions"
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

function JsonBlock({ value }: { value: unknown }) {
  if (!value) return <p className="text-sm text-muted-foreground">No data</p>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden sm:max-w-[min(96vw,86rem)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Ticket detail
            {ticket && <Badge variant={ticket.livemode ? "outline" : "secondary"}>{ticket.livemode ? "Live" : "Sandbox"}</Badge>}
          </SheetTitle>
          <SheetDescription className="font-mono">
            {ticket?.id ?? "Loading..."}
          </SheetDescription>
        </SheetHeader>

        {ticket && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="RFC" value={<span className="font-mono">{ticket.taxId}</span>} />
              <Detail label="Status" value={<Badge>{ticket.status}</Badge>} />
              <Detail label="Invoice" value={ticket.invoice?.uuid ?? ticket.invoiceId ?? "—"} />
            </div>

            <Accordion
              type="multiple"
              defaultValue={["image", "documents", "request", "response"]}
              className="mt-4 rounded-xl border px-4"
            >
              <AccordionItem value="image">
                <AccordionTrigger>Ticket image</AccordionTrigger>
                <AccordionContent>
                  {image ? (
                    <div className="overflow-hidden rounded-lg border bg-muted/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.originalFileName}
                        className="max-h-[34rem] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No ticket image found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="documents">
                <AccordionTrigger>Documents</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-2">
                    {ticket.documents.map((doc) => (
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="request">
                <AccordionTrigger>Request</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={ticket.submitRequest} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="response">
                <AccordionTrigger>Response</AccordionTrigger>
                <AccordionContent>
                  <JsonBlock value={ticket.lastResponse} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="final-response">
                <AccordionTrigger>Final response</AccordionTrigger>
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
