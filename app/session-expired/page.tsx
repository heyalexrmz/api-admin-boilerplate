import type { Metadata } from "next"
import { Clock3 } from "lucide-react"

import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { SessionExpiredActions } from "@/components/session-expired-actions"

export const metadata: Metadata = {
  title: "Sesión expirada · Taxo Timbre",
  description: "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
}

export default function SessionExpiredPage() {
  return (
    <AuthShell
      footer={
        <>
          Por seguridad, las sesiones expiran después de 12 horas de inactividad.
        </>
      }
    >
      <AuthCard
        title="Sesión expirada"
        description="Por seguridad, cerramos tu sesión después de un periodo de inactividad."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 px-4 py-6 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock3 className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-pretty text-muted-foreground">
              Inicia sesión de nuevo para continuar. Los cambios no guardados podrían
              haberse perdido.
            </p>
          </div>

          <SessionExpiredActions />
        </div>
      </AuthCard>
    </AuthShell>
  )
}
