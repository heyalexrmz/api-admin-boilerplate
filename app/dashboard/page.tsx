import { getDashboardTicketOverview } from "@/app/actions/facturador"
import { TicketRequestOverview } from "@/components/overview/ticket-request-overview"

export const metadata = {
  title: "Resumen · Taxo Timbre",
  description: "Resumen de solicitudes de tickets",
}

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const overview = await getDashboardTicketOverview()
  return <TicketRequestOverview overview={overview} />
}
