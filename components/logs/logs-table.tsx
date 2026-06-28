"use client"

import { useMemo, type ReactNode } from "react"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import type { RequestLog } from "@/app/lib/definitions"
import { DataTable } from "@/components/data-table"
import { MethodBadge, StatusBadge } from "@/components/logs/log-badges"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatTime } from "@/lib/format"

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

function latencyColor(ms: number): string {
  if (ms >= 1000) return "text-rose-600 dark:text-rose-400"
  if (ms >= 500) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

export function LogsTable({
  logs,
  onSelect,
}: {
  logs: RequestLog[]
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
          <span className={cn("font-mono tabular-nums", latencyColor(row.original.latencyMs))}>
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
          <span className="text-muted-foreground">{row.original.keyName}</span>
        ),
      },
    ],
    []
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
