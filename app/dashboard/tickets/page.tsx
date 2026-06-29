import { listDashboardTickets } from "@/app/actions/facturador"
import { getDashboardCapabilities } from "@/app/lib/auth"
import { TicketsView } from "@/components/tickets/tickets-view"

export const dynamic = "force-dynamic"

export default async function TicketsPage() {
  const [tickets, capabilities] = await Promise.all([
    listDashboardTickets(),
    getDashboardCapabilities(),
  ])

  return <TicketsView initialTickets={tickets} canManage={capabilities.canManage} />
}
