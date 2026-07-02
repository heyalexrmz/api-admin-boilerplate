import { LogsView } from "@/components/logs/logs-view"
import { NoAccessCard } from "@/components/no-access-card"
import { listRequestLogs } from "@/app/actions/logs"
import { getCanManageActiveOrg } from "@/app/lib/auth"
import { DEFAULT_LATENCY_THRESHOLDS } from "@/lib/latency-thresholds"

export const metadata = {
  title: "Registros · Taxo Timbre",
  description: "Registros de solicitudes API",
}

export const dynamic = "force-dynamic"

export default async function LogsPage() {
  const canManage = await getCanManageActiveOrg()
  if (!canManage) return <NoAccessCard />
  const logs = await listRequestLogs()
  return <LogsView initialLogs={logs} latencyThresholds={DEFAULT_LATENCY_THRESHOLDS} />
}
