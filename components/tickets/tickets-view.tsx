"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  type Column,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, FileText, RefreshCw } from "lucide-react"

import {
  getDashboardTicketDetail,
  refreshDashboardTicket,
} from "@/app/actions/facturador"
import type { DashboardTicket, DashboardTicketDetail } from "@/app/lib/definitions"
import { EmptyState } from "@/components/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/filter-bar"
import { DataTable } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { TicketDetailSheet } from "@/components/tickets/ticket-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/lib/toast"
import { formatDate, formatRelativeTime } from "@/lib/format"

function ModeBadge({ livemode }: { livemode: boolean }) {
  return <Badge variant={livemode ? "outline" : "secondary"}>{livemode ? "Producción" : "Sandbox"}</Badge>
}

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

export function TicketsView({
  initialTickets,
  canManage,
}: {
  initialTickets: DashboardTicket[]
  canManage: boolean
}) {
  const [query, setQuery] = useState("")
  const [tickets] = useState(initialTickets)
  const [selected, setSelected] = useState<DashboardTicketDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [status, setStatus] = useState("all")
  const [mode, setMode] = useState("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((ticket) =>
      (status === "all" || ticket.status === status) &&
      (mode === "all" || (mode === "live" ? ticket.livemode : !ticket.livemode)) &&
      (!q ||
        `${ticket.id} ${ticket.taxId} ${ticket.status} ${ticket.invoiceUuid ?? ""}`
          .toLowerCase()
          .includes(q))
    )
  }, [mode, query, status, tickets])

  async function queueRefresh(id: string) {
    const result = await refreshDashboardTicket(id)
    if ("error" in result) toast.error(result.error)
    else toast.success("Refresh queued")
  }

  async function openTicket(id: string) {
    const detail = await getDashboardTicketDetail(id)
    if (!detail) {
      toast.error("Ticket not found")
      return
    }
    setSelected(detail)
    setDetailOpen(true)
  }

  const columns = useMemo<ColumnDef<DashboardTicket>[]>(
    () => [
      {
        accessorKey: "id",
        size: 260,
        header: ({ column }) => <SortableHeader column={column}>Ticket</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs">{row.original.id}</span>
            {row.original.originalFileName && (
              <span className="text-xs text-muted-foreground">{row.original.originalFileName}</span>
            )}
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
        header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "livemode",
        size: 110,
        header: ({ column }) => <SortableHeader column={column}>Modo</SortableHeader>,
        cell: ({ row }) => <ModeBadge livemode={row.original.livemode} />,
      },
      {
        accessorKey: "invoiceUuid",
        size: 220,
        header: "Factura",
        cell: ({ row }) =>
          row.original.invoiceUuid ? (
            <span className="font-mono text-xs">{row.original.invoiceUuid}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "documentCount",
        size: 110,
        header: ({ column }) => <SortableHeader column={column}>Documentos</SortableHeader>,
      },
      {
        accessorKey: "createdAt",
        size: 140,
        header: ({ column }) => <SortableHeader column={column}>Creado</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatRelativeTime(row.original.createdAt)}</span>
            <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
          </div>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              size: 190,
              header: () => <span className="sr-only">Acciones</span>,
              enableSorting: false,
              cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      queueRefresh(row.original.id)
                    }}
                  >
                    <RefreshCw />
                    Reintentar
                  </Button>
                </div>
              ),
            } satisfies ColumnDef<DashboardTicket>,
          ]
        : []),
    ],
    [canManage]
  )

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin tickets"
        description="Las solicitudes de tickets aparecerán aquí cuando tus clientes usen la API v1."
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
              placeholder="Buscar tickets, RFC, factura..."
              ariaLabel="Buscar tickets"
            />
          }
          resultCount={filtered.length}
          totalCount={tickets.length}
          resultLabel="tickets"
          isFiltered={query.trim().length > 0}
          onClear={() => setQuery("")}
        >
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="received">Recibido</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="processing">Procesando</SelectItem>
              <SelectItem value="finalized">Finalizado</SelectItem>
              <SelectItem value="failed">Fallido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-36" aria-label="Filter by mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los modos</SelectItem>
              <SelectItem value="live">Producción</SelectItem>
              <SelectItem value="test">Sandbox</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          caption="Tickets"
          empty="No hay tickets que coincidan con tus filtros."
          onRowClick={(ticket) => openTicket(ticket.id)}
        />
      </div>
      <TicketDetailSheet
        ticket={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
