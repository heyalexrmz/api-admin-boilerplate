import type { Webhook } from "@/app/lib/definitions"
import { StatusBadge } from "@/components/status-badge"

export function WebhookStatusBadge({ status }: { status: Webhook["status"] }) {
  return <StatusBadge status={status} />
}
