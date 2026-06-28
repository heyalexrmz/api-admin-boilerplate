"use client"

import { useId, useState } from "react"
import { Mail, Monitor, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SettingsSection } from "@/components/settings/settings-section"

type Session = {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
  icon: typeof Monitor
}

const INITIAL_SESSIONS: Session[] = [
  {
    id: "s1",
    device: "Mac · Chrome",
    location: "Chicago, US",
    lastActive: "Active now",
    current: true,
    icon: Monitor,
  },
  {
    id: "s2",
    device: "Windows · Edge",
    location: "Berlin, DE",
    lastActive: "2 hours ago",
    current: false,
    icon: Monitor,
  },
  {
    id: "s3",
    device: "iPhone · Safari",
    location: "Chicago, US",
    lastActive: "3 days ago",
    current: false,
    icon: Smartphone,
  },
]

export function SecurityTab() {
  const [twoFactor, setTwoFactor] = useState(true)
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS)
  useId()

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    toast.success("Session revoked")
  }

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
              <p className="text-sm font-medium">
                {twoFactor ? "Enabled" : "Disabled"}
              </p>
              <p className="text-xs text-muted-foreground">
                {twoFactor
                  ? "You'll be prompted for a code at sign-in."
                  : "Protect your account with a second factor."}
              </p>
            </div>
          </div>
          <Switch
            checked={twoFactor}
            onCheckedChange={(checked) => {
              setTwoFactor(checked)
              toast.success(checked ? "2FA enabled" : "2FA disabled")
            }}
            aria-label="Toggle two-factor authentication"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Active sessions"
        description="Devices currently signed into your account. Revoke any you don't recognize."
      >
        <ul className="flex flex-col divide-y divide-border">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <session.icon />
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
                    {session.location} · {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => revokeSession(session.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <Button
            type="button"
            variant="outline"
            className="h-9 self-start"
            onClick={() => {
              setSessions((prev) => prev.filter((s) => s.current))
              toast.success("Signed out of all other sessions")
            }}
          >
            Sign out everywhere else
          </Button>
        )}
      </SettingsSection>
    </div>
  )
}
