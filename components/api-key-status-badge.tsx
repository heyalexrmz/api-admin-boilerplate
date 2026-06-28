import type { ApiKey } from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"

export function ApiKeyStatusBadge({ status }: { status: ApiKey["status"] }) {
  if (status === "revoked") {
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-1.5 rounded-full bg-destructive" />
        Revoked
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Expired
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
