import type { Webhook } from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"

export function WebhookStatusBadge({ status }: { status: Webhook["status"] }) {
  if (status === "disabled") {
    return (
      <Badge variant="outline" className="gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Disabled
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Active
    </Badge>
  )
}
