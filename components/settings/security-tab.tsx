"use client"

import { useState, useTransition } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { toast } from "@/lib/toast"

import { revokeOtherSessions, revokeSession } from "@/app/actions/sessions"
import type { SessionView } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import { SettingsSection } from "@/components/settings/settings-section"

export function SecurityTab({
  initialSessions,
}: {
  initialSessions: SessionView[]
}) {
  const [sessions, setSessions] = useState<SessionView[]>(initialSessions)
  const [pendingId, startRevoke] = useTransition()
  const [pendingAll, startRevokeAll] = useTransition()

  function handleRevoke(id: string) {
    startRevoke(async () => {
      const result = await revokeSession(id)
      if ("success" in result) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        toast.success("Sesión revocada")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRevokeOthers() {
    startRevokeAll(async () => {
      const result = await revokeOtherSessions()
      if ("success" in result) {
        setSessions((prev) => prev.filter((s) => s.current))
        toast.success(
          result.revoked > 0
            ? `Cerramos ${result.revoked} sesión${result.revoked === 1 ? "" : "es"} adicional${result.revoked === 1 ? "" : "es"}`
            : "No hay otras sesiones por cerrar"
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  const otherSessions = sessions.filter((s) => !s.current)

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Sesiones activas"
        description="Dispositivos con sesión iniciada en tu cuenta. Revoca cualquiera que no reconozcas."
      >
        {sessions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No encontramos sesiones activas.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {sessions.map((session) => {
              const Icon = session.isMobile ? Smartphone : Monitor
              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {session.device}
                        {session.current && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                            Este dispositivo
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.location ?? "Ubicación desconocida"} · {session.lastActive}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={pendingId}
                      onClick={() => handleRevoke(session.id)}
                    >
                      Revocar
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {otherSessions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-9 self-start"
            disabled={pendingAll}
            onClick={handleRevokeOthers}
          >
            Cerrar las demás sesiones
          </Button>
        )}
      </SettingsSection>
    </div>
  )
}
