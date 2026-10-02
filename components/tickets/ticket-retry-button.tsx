"use client"

import { LoaderCircle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function TicketRetryButton({
  ticketId,
  pending,
  disabled,
  onRetry,
}: {
  ticketId: string
  pending: boolean
  disabled: boolean
  onRetry: (id: string) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      aria-busy={pending}
      aria-label={`Reintentar ticket ${ticketId}`}
      title="Volver a enviar este ticket sin consumir otro crédito"
      onClick={(event) => {
        event.stopPropagation()
        onRetry(ticketId)
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
      {pending ? "Reintentando…" : "Reintentar"}
    </Button>
  )
}
