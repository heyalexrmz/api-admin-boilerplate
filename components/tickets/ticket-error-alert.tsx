import { CircleAlert } from "lucide-react"

import type { DashboardTicketDetail } from "@/app/lib/definitions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { publicTicketError } from "@/lib/facturador/public-errors"

type TicketError = Pick<DashboardTicketDetail, "status" | "errorCode" | "errorType" | "errorMessage">

export function TicketErrorAlert({ ticket }: { ticket: TicketError }) {
  if (ticket.status !== "failed") return null
  const error = publicTicketError({ code: ticket.errorCode, type: ticket.errorType, message: ticket.errorMessage })
  if (!error) return null

  return (
    <Alert variant="destructive" className="mt-4">
      <CircleAlert />
      <AlertTitle>No se pudo facturar el ticket</AlertTitle>
      <AlertDescription>
        <p>{error.message ?? "No fue posible completar la solicitud. Contacta a soporte."}</p>
        {error.code === "UPSTREAM_RATE_LIMITED" && <p>Este ticket quedó fallido y no se reenviará automáticamente.</p>}
        {error.code && <p className="mt-1 font-mono text-xs">{error.code}{error.type ? ` · ${error.type}` : ""}</p>}
      </AlertDescription>
    </Alert>
  )
}
