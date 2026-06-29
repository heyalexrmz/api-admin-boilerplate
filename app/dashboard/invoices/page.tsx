import { listDashboardInvoices } from "@/app/actions/facturador"
import { InvoicesView } from "@/components/invoices/invoices-view"

export const dynamic = "force-dynamic"

export default async function InvoicesPage() {
  const invoices = await listDashboardInvoices()
  return <InvoicesView initialInvoices={invoices} />
}
