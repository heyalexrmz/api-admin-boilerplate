import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  active: {
    badge: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  success: {
    badge: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  finalized: {
    badge: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  accepted: {
    badge: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  processing: {
    badge: "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  retrying: {
    badge: "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  pending: {
    badge: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  queued: {
    badge: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  received: {
    badge: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  expired: {
    badge: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  failed: {
    badge: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  revoked: {
    badge: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  rejected: {
    badge: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  canceled: {
    badge: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  cancelled: {
    badge: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  disabled: {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
}

function statusLabel(status: string) {
  return status
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const normalized = status.toLowerCase()
  const style = STATUS_STYLES[normalized] ?? {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  }

  return (
    <Badge variant="outline" className={cn("gap-1", style.badge, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {statusLabel(normalized)}
    </Badge>
  )
}
