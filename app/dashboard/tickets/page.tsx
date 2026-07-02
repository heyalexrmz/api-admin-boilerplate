import { listDashboardTickets } from "@/app/actions/facturador"
import { TicketsView } from "@/components/tickets/tickets-view"

export const dynamic = "force-dynamic"

export default async function TicketsPage() {
  const tickets = await listDashboardTickets()

  return <TicketsView initialTickets={tickets} />
}
