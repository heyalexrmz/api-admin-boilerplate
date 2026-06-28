"use client"

import { CopyButton } from "@/components/copy-button"
import { MethodBadge, StatusBadge } from "@/components/logs/log-badges"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { RequestHeader, RequestLog } from "@/app/lib/definitions"
import { formatDateTime } from "@/lib/format"

function prettyJson(body: string | null): string | null {
  if (!body) return null
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
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

function HeaderList({ headers }: { headers: RequestHeader[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border">
      {headers.map((header, index) => (
        <div
          key={header.name}
          className={
            "flex gap-3 px-3 py-2 text-xs " +
            (index > 0 ? "border-t" : "")
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

function JsonBlock({ body }: { body: string | null }) {
  const pretty = prettyJson(body)
  if (!pretty) {
    return <p className="text-sm text-muted-foreground">No body</p>
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {pretty}
    </pre>
  )
}

export function LogDetailsSheet({
  log,
  open,
  onOpenChange,
}: {
  log: RequestLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {log && <MethodBadge method={log.method} />}
            <span className="font-mono text-sm">{log?.path}</span>
          </SheetTitle>
          <SheetDescription>
            {log && (
              <span className="inline-flex items-center gap-2">
                <StatusBadge status={log.status} />
                <span>{log.latencyMs} ms</span>
                <span aria-hidden="true">·</span>
                <span>{formatDateTime(log.timestamp)}</span>
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {log && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <dl className="grid grid-cols-2 gap-3">
              <Detail label="Request ID" value={<span className="font-mono">{log.requestId}</span>} />
              <Detail label="Status" value={<StatusBadge status={log.status} />} />
              <Detail label="Method" value={<MethodBadge method={log.method} />} />
              <Detail label="Latency" value={`${log.latencyMs} ms`} />
              <Detail label="API key" value={log.keyName} />
              <Detail label="IP address" value={log.ip} />
              <Detail label="Path" value={<span className="font-mono">{log.path}</span>} />
              <Detail label="User agent" value={log.userAgent} />
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <SectionTitle>Request headers</SectionTitle>
              <HeaderList headers={log.requestHeaders} />
              <SectionTitle>Request body</SectionTitle>
              <JsonBlock body={log.requestBody} />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <SectionTitle>Response headers</SectionTitle>
              <HeaderList headers={log.responseHeaders} />
              <SectionTitle>Response body</SectionTitle>
              <JsonBlock body={log.responseBody} />
            </div>
          </div>
        )}

        {log && (
          <SheetFooter>
            <CopyButton
              value={log.requestId}
              label="Request ID"
              variant="outline"
              className="w-full"
            />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
