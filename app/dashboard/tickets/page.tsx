import { listDashboardTickets } from "@/app/actions/facturador"
import { TicketsView } from "@/components/tickets/tickets-view"
import { getCanManageActiveOrg } from "@/app/lib/auth"

export const dynamic = "force-dynamic"

export default async function TicketsPage() {
  const [tickets, canManage] = await Promise.all([
    listDashboardTickets(),
    getCanManageActiveOrg(),
  ])

  return <TicketsView initialTickets={tickets} canManage={canManage} />
}
