import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileWarning,
  Ticket,
  type LucideIcon,
} from "lucide-react"

import type {
  DashboardTicket,
  DashboardTicketOverview,
} from "@/app/lib/definitions"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, formatRelativeTime } from "@/lib/format"

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: number
  note: string
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-xs text-muted-foreground">{note}</span>
      </CardContent>
    </Card>
  )
}

function RecentTicketRow({ ticket }: { ticket: DashboardTicket }) {
  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-mono text-xs">{ticket.id}</p>
          <StatusBadge status={ticket.status} />
          <Badge variant={ticket.livemode ? "outline" : "secondary"}>
            {ticket.livemode ? "Producción" : "Sandbox"}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{ticket.taxId}</span>
          {ticket.originalFileName && <span>{ticket.originalFileName}</span>}
          <span>{formatRelativeTime(ticket.createdAt)}</span>
          <span>{formatDate(ticket.createdAt)}</span>
        </div>
      </div>
      <Button asChild variant="ghost" size="sm" className="justify-self-start sm:justify-self-end">
        <Link href="/dashboard/tickets">
          Ver solicitud
          <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}

export function TicketRequestOverview({
  overview,
}: {
  overview: DashboardTicketOverview
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total de tickets"
          value={overview.total}
          note="todas las solicitudes recibidas"
          icon={Ticket}
        />
        <MetricCard
          label="Nuevos (24h)"
          value={overview.last24h}
          note="creados en el último día"
          icon={Clock}
        />
        <MetricCard
          label="Activos"
          value={overview.active}
          note="recibidos, en cola, pendientes o procesando"
          icon={Activity}
        />
        <MetricCard
          label="Fallidos"
          value={overview.failed}
          note="solicitudes que requieren revisión"
          icon={FileWarning}
        />
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Solicitudes recientes</CardDescription>
          <CardTitle>Últimos tickets</CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 />
              {overview.finalized} finalizados
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {overview.recentTickets.length > 0 ? (
            <div className="grid gap-2">
              {overview.recentTickets.map((ticket) => (
                <RecentTicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Las solicitudes aparecerán aquí cuando tus clientes usen la API v1.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
