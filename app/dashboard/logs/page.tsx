import { LogsView } from "@/components/logs/logs-view"
import { NoAccessCard } from "@/components/no-access-card"
import { listRequestLogs } from "@/app/actions/logs"
import { getCanManageActiveOrg } from "@/app/lib/auth"

export const metadata = {
  title: "Logs · Dashboard",
  description: "API request logs",
}

export const dynamic = "force-dynamic"

export default async function LogsPage() {
  const canManage = await getCanManageActiveOrg()
  if (!canManage) return <NoAccessCard />
  const logs = await listRequestLogs()
  return <LogsView initialLogs={logs} />
}
