import { getDashboardTicketOverview } from "@/app/actions/facturador"
import { TicketRequestOverview } from "@/components/overview/ticket-request-overview"

export const metadata = {
  title: "Overview · Dashboard",
  description: "Ticket request overview",
}

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const overview = await getDashboardTicketOverview()
  return <TicketRequestOverview overview={overview} />
}
