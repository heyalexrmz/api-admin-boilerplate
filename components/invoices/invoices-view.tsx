"use client"

import { useMemo, useState, type ReactNode } from "react"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, ReceiptText } from "lucide-react"

import { getDashboardInvoiceDetail } from "@/app/actions/facturador"
import type { DashboardInvoice, DashboardInvoiceDetail } from "@/app/lib/definitions"
import { DataTable } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/filter-bar"
import { InvoiceDetailSheet } from "@/components/invoices/invoice-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { toast } from "@/lib/toast"

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

export function InvoicesView({ initialInvoices }: { initialInvoices: DashboardInvoice[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState<DashboardInvoiceDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const invoices = initialInvoices
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((invoice) =>
      (status === "all" || invoice.status === status) &&
      (!q ||
        `${invoice.id} ${invoice.ticketId} ${invoice.taxId} ${invoice.uuid ?? ""} ${invoice.issuerTaxpayer ?? ""}`
          .toLowerCase()
          .includes(q))
    )
  }, [invoices, query, status])

  async function openInvoice(id: string) {
    const detail = await getDashboardInvoiceDetail(id)
    if (!detail) {
      toast.error("Invoice not found")
      return
    }
    setSelected(detail)
    setDetailOpen(true)
  }

  const columns = useMemo<ColumnDef<DashboardInvoice>[]>(
    () => [
      {
        accessorKey: "uuid",
        size: 260,
        header: ({ column }) => <SortableHeader column={column}>Invoice</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs">{row.original.uuid ?? row.original.id}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.series ?? "—"} {row.original.folio ?? ""}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "taxId",
        size: 140,
        header: ({ column }) => <SortableHeader column={column}>RFC</SortableHeader>,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.taxId}</span>,
      },
      {
        accessorKey: "status",
        size: 120,
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "finalized" ? "default" : "outline"}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "total",
        size: 120,
        header: ({ column }) => <SortableHeader column={column}>Total</SortableHeader>,
        cell: ({ row }) => row.original.total ?? "—",
      },
      {
        accessorKey: "issuerTaxpayer",
        size: 220,
        header: ({ column }) => <SortableHeader column={column}>Issuer</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.issuerTaxpayer ?? "—"}</span>
            {row.original.issuerRfc && (
              <span className="font-mono text-xs text-muted-foreground">{row.original.issuerRfc}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "documentCount",
        size: 110,
        header: ({ column }) => <SortableHeader column={column}>Documents</SortableHeader>,
      },
      {
        accessorKey: "createdAt",
        size: 140,
        header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatRelativeTime(row.original.createdAt)}</span>
            <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
          </div>
        ),
      },
    ],
    []
  )

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No invoices"
        description="Finalized invoices will appear here with their SAT UUID, totals, and linked documents."
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <FilterBar
          search={
            <FilterSearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search invoices, RFC, UUID..."
              ariaLabel="Search invoices"
            />
          }
          resultCount={filtered.length}
          totalCount={invoices.length}
          resultLabel="invoices"
          isFiltered={query.trim().length > 0}
          onClear={() => setQuery("")}
        >
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          caption="Invoices"
          empty="No invoices match your filters."
          onRowClick={(invoice) => openInvoice(invoice.id)}
        />
      </div>
      <InvoiceDetailSheet
        invoice={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
