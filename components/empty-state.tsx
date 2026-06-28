import { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick?: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-[60vh] min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button className="mt-6 h-9 transition-transform active:scale-[0.96]" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
