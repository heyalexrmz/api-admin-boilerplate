"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  type Column,
  type ColumnDef,
} from "@tanstack/react-table"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  CalendarIcon,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  FileText,
  X,
  XCircle,
} from "lucide-react"

import {
  getDashboardTicketDetail,
} from "@/app/actions/facturador"
import type { DashboardTicket, DashboardTicketDetail } from "@/app/lib/definitions"
import { EmptyState } from "@/components/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/filter-bar"
import { DataTable } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { TicketDetailSheet } from "@/components/tickets/ticket-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/lib/toast"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const IN_PROCESS_STATUSES = new Set(["received", "queued", "pending", "processing"])

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

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function matchesDateRange(ticket: DashboardTicket, range: DateRange | undefined) {
  if (!range?.from && !range?.to) return true
  const createdAt = new Date(ticket.createdAt)
  if (Number.isNaN(createdAt.getTime())) return true
  if (range.from && createdAt < startOfLocalDay(range.from)) return false
  if (range.to && createdAt > endOfLocalDay(range.to)) return false
  return true
}

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const label =
    value?.from && value?.to
      ? `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`
      : value?.from
        ? `${format(value.from, "MMM d, yyyy")} - ...`
        : "Rango de fechas"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start gap-2 px-2.5 text-left font-normal sm:w-[250px]",
            !value?.from && "text-muted-foreground"
          )}
          aria-label="Filtrar por rango de fechas"
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {value?.from && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar rango de fechas"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onChange(undefined)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange(undefined)
                }
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          numberOfMonths={2}
          disabled={{ after: new Date() }}
          onSelect={(range) => {
            onChange(range)
            if (range?.from && range?.to) setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: number
  icon: typeof Clock3
  tone: "process" | "success" | "failed"
}) {
  const toneClass = {
    process: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  }[tone]

  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <div className={cn("flex size-8 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

export function TicketsView({
  initialTickets,
}: {
  initialTickets: DashboardTicket[]
}) {
  const [query, setQuery] = useState("")
  const [tickets] = useState(initialTickets)
  const [selected, setSelected] = useState<DashboardTicketDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [status, setStatus] = useState("all")
  const [mode, setMode] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const scopedTickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((ticket) =>
      (mode === "all" || (mode === "live" ? ticket.livemode : !ticket.livemode)) &&
      matchesDateRange(ticket, dateRange) &&
      (!q ||
        `${ticket.id} ${ticket.taxId} ${ticket.status} ${ticket.invoiceUuid ?? ""}`
          .toLowerCase()
          .includes(q))
    )
  }, [dateRange, mode, query, tickets])

  const filtered = useMemo(
    () =>
      scopedTickets.filter((ticket) =>
        status === "all" || ticket.status === status
      ),
    [scopedTickets, status]
  )

  const kpis = useMemo(() => {
    return scopedTickets.reduce(
      (acc, ticket) => {
        if (IN_PROCESS_STATUSES.has(ticket.status)) acc.inProcess += 1
        if (ticket.status === "failed") acc.failed += 1
        if (ticket.status === "finalized") acc.success += 1
        return acc
      },
      { inProcess: 0, failed: 0, success: 0 }
    )
  }, [scopedTickets])

  const isFiltered =
    query.trim().length > 0 ||
    status !== "all" ||
    mode !== "all" ||
    !!dateRange?.from ||
    !!dateRange?.to

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
    ],
    []
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
        <div className="grid gap-3 md:grid-cols-3">
          <KpiCard
            title="En proceso"
            value={kpis.inProcess}
            icon={Clock3}
            tone="process"
          />
          <KpiCard
            title="Exitosos"
            value={kpis.success}
            icon={CheckCircle2}
            tone="success"
          />
          <KpiCard
            title="Fallidos"
            value={kpis.failed}
            icon={XCircle}
            tone="failed"
          />
        </div>

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
          isFiltered={isFiltered}
          onClear={() => {
            setQuery("")
            setStatus("all")
            setMode("all")
            setDateRange(undefined)
          }}
        >
          <DateRangePicker value={dateRange} onChange={setDateRange} />
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
