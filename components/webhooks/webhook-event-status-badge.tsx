import type { WebhookEventLogStatus } from "@/app/lib/definitions"
import { WebhookEventLogStatusLabels } from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STYLES: Record<WebhookEventLogStatus, string> = {
  success:
    "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed:
    "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
  pending:
    "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  retrying:
    "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

const DOT: Record<WebhookEventLogStatus, string> = {
  success: "bg-emerald-500",
  failed: "bg-rose-500",
  pending: "bg-amber-500",
  retrying: "bg-sky-500",
}

export function WebhookEventStatusBadge({
  status,
  className,
}: {
  status: WebhookEventLogStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", STYLES[status], className)}
    >
      <span className={cn("size-1.5 rounded-full", DOT[status])} />
      {WebhookEventLogStatusLabels[status]}
    </Badge>
  )
}
