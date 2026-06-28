import * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function Field({
  id,
  label,
  description,
  error,
  children,
  className,
}: {
  id: string
  label: React.ReactNode
  description?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
