import type { ApiKey } from "@/app/lib/definitions"
import { StatusBadge } from "@/components/status-badge"

export function ApiKeyStatusBadge({ status }: { status: ApiKey["status"] }) {
  return <StatusBadge status={status} />
}
