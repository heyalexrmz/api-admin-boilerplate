import type { WebhookEventLogStatus } from "@/app/lib/definitions"
import { StatusBadge } from "@/components/status-badge"

export function WebhookEventStatusBadge({
  status,
  className,
}: {
  status: WebhookEventLogStatus
  className?: string
}) {
  return <StatusBadge status={status} className={className} />
}
