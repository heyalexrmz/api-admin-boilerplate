"use client"

import { CopyButton } from "@/components/copy-button"
import { WebhookEventStatusBadge } from "@/components/webhooks/webhook-event-status-badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { WebhookEventLog } from "@/app/lib/definitions"
import { formatDateTime } from "@/lib/format"

function prettyJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  )
}

function HeaderList({
  headers,
}: {
  headers: { name: string; value: string }[] | null
}) {
  if (!headers || headers.length === 0) {
    return <p className="text-sm text-muted-foreground">No headers</p>
  }
  return (
    <dl className="overflow-hidden rounded-lg border">
      {headers.map((header, index) => (
        <div
          key={header.name + index}
          className={
            "flex gap-3 px-3 py-2 text-xs " + (index > 0 ? "border-t" : "")
          }
        >
          <dt className="w-40 shrink-0 font-mono text-muted-foreground">
            {header.name}
          </dt>
          <dd className="min-w-0 break-all font-mono">{header.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  const pretty = prettyJson(value)
  if (!pretty) {
    return <p className="text-sm text-muted-foreground">No body</p>
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {pretty}
    </pre>
  )
}

export function WebhookEventDetailsSheet({
  eventLog,
  open,
  onOpenChange,
}: {
  eventLog: WebhookEventLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {eventLog && (
              <WebhookEventStatusBadge status={eventLog.status} />
            )}
            <code className="font-mono text-sm">
              {eventLog?.eventType}
            </code>
          </SheetTitle>
          <SheetDescription>
            {eventLog && (
              <span className="inline-flex items-center gap-2">
                <span>{formatDateTime(eventLog.createdAt)}</span>
                {eventLog.latencyMs !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{eventLog.latencyMs} ms</span>
                  </>
                )}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {eventLog && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <dl className="grid grid-cols-2 gap-3">
              <Detail
                label="Event ID"
                value={<span className="font-mono">{eventLog.eventId}</span>}
              />
              <Detail
                label="Status"
                value={<WebhookEventStatusBadge status={eventLog.status} />}
              />
              <Detail
                label="HTTP status"
                value={
                  eventLog.httpStatus !== null ? (
                    <span className="font-mono">{eventLog.httpStatus}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Detail
                label="Attempts"
                value={<span className="tabular-nums">{eventLog.attemptCount}</span>}
              />
              <Detail
                label="Latency"
                value={
                  eventLog.latencyMs !== null
                    ? `${eventLog.latencyMs} ms`
                    : "—"
                }
              />
              <Detail
                label="Delivered at"
                value={
                  eventLog.deliveredAt
                    ? formatDateTime(eventLog.deliveredAt)
                    : "—"
                }
              />
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <SectionTitle>Payload</SectionTitle>
              <JsonBlock value={eventLog.payload} />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <SectionTitle>Response headers</SectionTitle>
              <HeaderList headers={eventLog.responseHeaders} />
              <SectionTitle>Response body</SectionTitle>
              <JsonBlock value={eventLog.responseBody} />
            </div>
          </div>
        )}

        {eventLog && (
          <SheetFooter>
            <CopyButton
              value={eventLog.eventId}
              label="Event ID"
              variant="outline"
              className="w-full"
            />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
