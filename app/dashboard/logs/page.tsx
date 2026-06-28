import { LogsView } from "@/components/logs/logs-view"

export const metadata = {
  title: "Logs · Dashboard",
  description: "API request logs",
}

export default function LogsPage() {
  return <LogsView />
}
