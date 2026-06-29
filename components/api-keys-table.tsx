"use client"

import { useMemo, type ReactNode } from "react"
import {
  type Column,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { ApiKeyModeLabels, type ApiKey } from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { ApiKeyActions } from "@/components/api-key-actions"
import { ApiKeyStatusBadge } from "@/components/api-key-status-badge"
import { formatDate, formatRelativeTime } from "@/lib/format"

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
      <Icon
        className={
          sorted ? "size-3.5 opacity-70" : "size-3.5 opacity-40"
        }
      />
    </button>
  )
}

export function ApiKeysTable({
  keys,
  onRevoke,
  onRename,
  onRotate,
}: {
  keys: ApiKey[]
  onRevoke: (id: string) => void
  onRename: (id: string, name: string) => void
  onRotate: (id: string, preview: string, lastRotatedAt: string) => void
}) {
  const columns = useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: "name",
        size: 180,
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "preview",
        size: 190,
        header: "Key",
        enableSorting: false,
        cell: ({ row }) => {
          const key = row.original
          return (
            <div className="flex flex-col gap-0.5">
              <code className="font-mono text-xs text-muted-foreground">
                {key.preview}
              </code>
              {key.lastRotatedAt && (
                <span className="text-xs text-muted-foreground">
                  Rotated {formatRelativeTime(key.lastRotatedAt)}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "mode",
        size: 100,
        header: ({ column }) => (
          <SortableHeader column={column}>Mode</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.mode === "test" ? "secondary" : "outline"}>
            {ApiKeyModeLabels[row.original.mode]}
          </Badge>
        ),
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
        accessorKey: "lastUsedAt",
        size: 130,
        header: ({ column }) => (
          <SortableHeader column={column}>Last used</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.lastUsedAt)}
          </span>
        ),
      },
      {
        accessorKey: "expiresAt",
        size: 130,
        header: ({ column }) => (
          <SortableHeader column={column}>Expires</SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.expiresAt ? (
            <span className="text-muted-foreground">
              {formatDate(row.original.expiresAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      },
      {
        accessorKey: "status",
        size: 120,
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <ApiKeyStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "actions",
        size: 64,
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <ApiKeyActions
            apiKey={row.original}
            onRevoke={onRevoke}
            onRename={onRename}
            onRotate={onRotate}
          />
        ),
      },
    ],
    [onRevoke, onRename, onRotate]
  )

  return (
    <DataTable
      columns={columns}
      data={keys}
      caption="API keys"
      empty="No API keys yet."
    />
  )
}
