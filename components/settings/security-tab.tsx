"use client"

import { useState, useTransition } from "react"
import { Mail, Monitor, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "@/lib/toast"

import { revokeOtherSessions, revokeSession } from "@/app/actions/sessions"
import type { SessionView } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
        toast.success("Session revoked")
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
            ? `Signed out of ${result.revoked} other session${result.revoked === 1 ? "" : "s"}`
            : "No other sessions to sign out"
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
        title="Sign-in method"
        description="You sign in to Acme with a secure link sent to your email address. There is no password to remember or change."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Mail />
            </span>
            <div>
              <p className="text-sm font-medium">Email magic link</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll email a one-time link to your work address whenever you sign in.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Two-factor authentication"
        description="Add a second step at sign-in using an authenticator app."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck />
            </span>
            <div>
              <p className="text-sm font-medium">Not configured</p>
              <p className="text-xs text-muted-foreground">
                Two-factor authentication isn&apos;t available yet. We&apos;ll notify you when it lands.
              </p>
            </div>
          </div>
          <Switch
            checked={false}
            disabled
            aria-label="Two-factor authentication is not available"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Active sessions"
        description="Devices currently signed into your account. Revoke any you don't recognize."
      >
        {sessions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No active sessions found.
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
                            This device
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.location ?? "Unknown location"} · {session.lastActive}
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
                      Revoke
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
            Sign out everywhere else
          </Button>
        )}
      </SettingsSection>
    </div>
  )
}
