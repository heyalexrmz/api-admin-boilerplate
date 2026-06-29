"use client"

import { useMemo, type ReactNode } from "react"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import type { WebhookEventLog, WebhookEventLogStatus } from "@/app/lib/definitions"
import { DataTable } from "@/components/data-table"
import { WebhookEventStatusBadge } from "@/components/webhooks/webhook-event-status-badge"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, formatRelativeTime } from "@/lib/format"

function SortableHeader<TData>({
  column,
  children,
}: {
  column: Column<TData, unknown>
  children: ReactNode
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 text-left font-medium"
    >
      {children}
      <Icon className={sorted ? "size-3.5 opacity-70" : "size-3.5 opacity-40"} />
    </button>
  )
}

function HttpStatusBadge({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const tone =
    status >= 500
      ? "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : status >= 400
        ? "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : status >= 300
          ? "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  return (
    <Badge variant="outline" className={`font-mono tabular-nums ${tone}`}>
      {status}
    </Badge>
  )
}

export function WebhookEventLogsTable({
  eventLogs,
  onRowClick,
}: {
  eventLogs: WebhookEventLog[]
  onRowClick: (log: WebhookEventLog) => void
}) {
  const columns = useMemo<ColumnDef<WebhookEventLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        size: 180,
        header: ({ column }) => (
          <SortableHeader column={column}>Delivered</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">
              {formatDateTime(row.original.createdAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(row.original.createdAt)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "eventType",
        size: 200,
        header: ({ column }) => (
          <SortableHeader column={column}>Event</SortableHeader>
        ),
        cell: ({ row }) => (
          <code className="font-mono text-xs">{row.original.eventType}</code>
        ),
      },
      {
        accessorKey: "eventId",
        size: 220,
        header: "Event ID",
        enableSorting: false,
        cell: ({ row }) => (
          <code className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {row.original.eventId}
          </code>
        ),
      },
      {
        accessorKey: "status",
        size: 130,
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <WebhookEventStatusBadge
            status={row.original.status as WebhookEventLogStatus}
          />
        ),
      },
      {
        accessorKey: "httpStatus",
        size: 110,
        header: "HTTP",
        enableSorting: false,
        cell: ({ row }) => <HttpStatusBadge status={row.original.httpStatus} />,
      },
      {
        accessorKey: "attemptCount",
        size: 100,
        header: ({ column }) => (
          <SortableHeader column={column}>Attempts</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.attemptCount}
          </span>
        ),
      },
      {
        accessorKey: "latencyMs",
        size: 110,
        header: ({ column }) => (
          <SortableHeader column={column}>Latency</SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.latencyMs !== null ? (
            <span className="tabular-nums text-muted-foreground">
              {row.original.latencyMs} ms
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    []
  )

  return (
    <DataTable
      columns={columns}
      data={eventLogs}
      caption="Webhook event logs"
      empty="No deliveries yet."
      onRowClick={onRowClick}
    />
  )
}
