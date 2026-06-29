"use client"

import { useMemo, type ReactNode } from "react"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import {
  WebhookEventLabels,
  type UpdatedWebhook,
  type Webhook,
  type WebhookEvent,
} from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { WebhookActions } from "@/components/webhooks/webhook-actions"
import { WebhookStatusBadge } from "@/components/webhooks/webhook-status-badge"
import { formatRelativeTime } from "@/lib/format"

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

export function WebhooksTable({
  webhooks,
  onUpdated,
  onRotated,
  onToggled,
  onTestEvent,
  onDeleted,
}: {
  webhooks: Webhook[]
  onUpdated: (id: string, updated: UpdatedWebhook) => void
  onRotated: (id: string, preview: string, lastRotatedAt: string) => void
  onToggled: (id: string, enabled: boolean) => void
  onTestEvent: (id: string) => void
  onDeleted: (id: string) => void
}) {
  const columns = useMemo<ColumnDef<Webhook>[]>(
    () => [
      {
        accessorKey: "name",
        size: 200,
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.name}</span>
            {row.original.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "url",
        size: 260,
        header: ({ column }) => (
          <SortableHeader column={column}>Endpoint</SortableHeader>
        ),
        cell: ({ row }) => (
          <code className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {row.original.url}
          </code>
        ),
      },
      {
        id: "events",
        size: 200,
        header: "Events",
        enableSorting: false,
        cell: ({ row }) => {
          const events = row.original.events
          if (events.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {events.slice(0, 2).map((event) => (
                <Badge key={event} variant="outline" className="text-xs">
                  {WebhookEventLabels[event as WebhookEvent] ?? event}
                </Badge>
              ))}
              {events.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{events.length - 2}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "createdAt",
        size: 130,
        header: ({ column }) => (
          <SortableHeader column={column}>Created</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "lastFiredAt",
        size: 130,
        header: ({ column }) => (
          <SortableHeader column={column}>Last delivery</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.lastFiredAt)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        size: 120,
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => <WebhookStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        size: 64,
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <WebhookActions
            webhook={row.original}
            onUpdated={onUpdated}
            onRotated={onRotated}
            onToggled={onToggled}
            onTestEvent={onTestEvent}
            onDeleted={onDeleted}
          />
        ),
      },
    ],
    [onUpdated, onRotated, onToggled, onTestEvent, onDeleted]
  )

  return (
    <DataTable
      columns={columns}
      data={webhooks}
      caption="Webhooks"
      empty="No webhooks yet."
    />
  )
}
