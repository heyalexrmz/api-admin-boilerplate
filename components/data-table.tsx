"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Optional message shown when there are no rows. */
  empty?: React.ReactNode
  /** Accessible label for the table element. */
  caption?: string
  /** When provided, rows become clickable and call this with the row's data. */
  onRowClick?: (row: TData) => void
  /** Rows per page. Defaults to 10. */
  pageSize?: number
  /** Page-size choices offered in the pagination footer. */
  pageSizeOptions?: number[]
  /** Preserve the page on data refresh; reset it only when this filter key changes. */
  paginationResetKey?: string
  /** Stable row identity for tables whose records update or move. */
  getRowId?: (row: TData) => string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  empty = "No results.",
  caption,
  onRowClick,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  paginationResetKey,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize,
  })
  const [previousResetKey, setPreviousResetKey] = React.useState(paginationResetKey)
  const lastPageIndex = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1)
  const nextPageIndex = previousResetKey !== paginationResetKey
    ? 0
    : Math.min(pagination.pageIndex, lastPageIndex)

  // Adjust before rendering rows so a shrinking result set never flashes an
  // empty/out-of-range page. Background refreshes otherwise preserve the page.
  if (previousResetKey !== paginationResetKey) setPreviousResetKey(paginationResetKey)
  if (pagination.pageIndex !== nextPageIndex) {
    setPagination({ ...pagination, pageIndex: nextPageIndex })
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((previous) => ({ ...previous, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: paginationResetKey === undefined,
    getRowId,
  })

  // Keep page size in sync when the prop changes (e.g. per-table overrides).
  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageSize === pageSize ? prev : { ...prev, pageSize, pageIndex: 0 }
    )
  }, [pageSize])

  function handleRowKeyDown(event: React.KeyboardEvent, row: TData) {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onRowClick?.(row)
    }
  }

  const pageCount = Math.max(1, table.getPageCount())
  const showPagination = data.length > 0
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination
  const rangeStart = pageIndex * currentPageSize
  const rangeEnd = Math.min(rangeStart + currentPageSize, data.length)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table aria-label={caption}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => handleRowKeyDown(event, row.original)
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "even:bg-muted/50 hover:bg-muted",
                  onRowClick && "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="h-24 text-center text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {showPagination && (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm tabular-nums lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <span>
              Mostrando{" "}
              <span className="font-medium text-foreground">
                {rangeStart + 1}–{rangeEnd}
              </span>{" "}
              de <span className="font-medium text-foreground">{data.length}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Filas por página</span>
              <Select
                value={String(currentPageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[76px] data-[size=default]:h-10" aria-label="Filas por página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </div>

          <nav aria-label={`Paginación${caption ? ` de ${caption}` : ""}`} className="flex items-center justify-center gap-1 sm:justify-end sm:gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 transition-colors"
              aria-label="Primera página"
              title="Primera página"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 min-w-10 gap-1 transition-colors"
              aria-label="Página anterior"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft aria-hidden="true" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="min-w-0 flex-1 text-center text-xs text-muted-foreground sm:min-w-28 sm:flex-none sm:px-2 sm:text-sm" role="status" aria-live="polite" aria-atomic="true">
              Página{" "}
              <span className="font-medium text-foreground">{pageIndex + 1}</span>{" "}
              de <span className="font-medium text-foreground">{pageCount}</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 min-w-10 gap-1 transition-colors"
              aria-label="Página siguiente"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 transition-colors"
              aria-label="Última página"
              title="Última página"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight aria-hidden="true" />
            </Button>
          </nav>
        </div>
      )}
    </div>
  )
}
