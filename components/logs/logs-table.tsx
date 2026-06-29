"use client"

import { useMemo, type ReactNode } from "react"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import type { LatencyThresholds, RequestLog } from "@/app/lib/definitions"
import { ApiKeyModeLabels } from "@/app/lib/definitions"
import { DataTable } from "@/components/data-table"
import { MethodBadge, StatusBadge } from "@/components/logs/log-badges"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatTime } from "@/lib/format"
import { latencyColor } from "@/lib/latency-thresholds"

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

export function LogsTable({
  logs,
  latencyThresholds,
  onSelect,
}: {
  logs: RequestLog[]
  latencyThresholds: LatencyThresholds
  onSelect: (log: RequestLog) => void
}) {
  const columns = useMemo<ColumnDef<RequestLog>[]>(
    () => [
      {
        accessorKey: "timestamp",
        size: 150,
        header: ({ column }) => (
          <SortableHeader column={column}>Time</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono tabular-nums text-foreground">
              {formatTime(row.original.timestamp)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(row.original.timestamp)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "method",
        size: 90,
        header: ({ column }) => (
          <SortableHeader column={column}>Method</SortableHeader>
        ),
        cell: ({ row }) => <MethodBadge method={row.original.method} />,
      },
      {
        accessorKey: "path",
        size: 220,
        header: ({ column }) => (
          <SortableHeader column={column}>Path</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.path}</span>
        ),
      },
      {
        accessorKey: "status",
        size: 90,
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "latencyMs",
        size: 110,
        header: ({ column }) => (
          <SortableHeader column={column}>Latency</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className={cn("font-mono tabular-nums", latencyColor(row.original.latencyMs, latencyThresholds))}>
            {row.original.latencyMs} ms
          </span>
        ),
      },
      {
        accessorKey: "keyName",
        size: 170,
        header: ({ column }) => (
          <SortableHeader column={column}>API key</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{row.original.keyName}</span>
            {row.original.keyMode && (
              <Badge variant={row.original.keyMode === "test" ? "secondary" : "outline"} className="text-xs">
                {ApiKeyModeLabels[row.original.keyMode]}
              </Badge>
            )}
          </div>
        ),
      },
    ],
    [latencyThresholds]
  )

  return (
    <DataTable
      columns={columns}
      data={logs}
      caption="Request logs"
      onRowClick={onSelect}
      empty="No request logs yet."
    />
  )
}
