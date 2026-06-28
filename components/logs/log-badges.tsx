import type { HttpMethod } from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400",
  POST: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PUT: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PATCH: "border-transparent bg-violet-500/10 text-violet-600 dark:text-violet-400",
  DELETE: "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

export function MethodBadge({
  method,
  className,
}: {
  method: HttpMethod
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-mono tracking-wide", METHOD_STYLES[method], className)}
    >
      {method}
    </Badge>
  )
}

function statusStyle(status: number): string {
  if (status >= 500) return "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400"
  if (status >= 400) return "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400"
  if (status >= 300) return "border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400"
  return "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
}

export function StatusBadge({
  status,
  className,
}: {
  status: number
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-mono tabular-nums", statusStyle(status), className)}
    >
      {status}
    </Badge>
  )
}
