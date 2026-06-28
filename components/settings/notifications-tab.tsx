"use client"

import { useState } from "react"
import { toast } from "@/lib/toast"

import { Switch } from "@/components/ui/switch"
import { SettingsSection } from "@/components/settings/settings-section"

type Pref = {
  id: string
  label: string
  description: string
  checked: boolean
}

const EMAIL_PREFS: Pref[] = [
  {
    id: "product",
    label: "Product updates",
    description: "New features and improvements as they ship.",
    checked: true,
  },
  {
    id: "security",
    label: "Security alerts",
    description: "Sign-ins from new devices and password changes.",
    checked: true,
  },
  {
    id: "billing",
    label: "Billing reminders",
    description: "Receipts, renewal notices, and usage thresholds.",
    checked: false,
  },
]

const INAPP_PREFS: Pref[] = [
  {
    id: "mentions",
    label: "Mention notifications",
    description: "When someone mentions you in a comment.",
    checked: true,
  },
  {
    id: "usage",
    label: "Usage spikes",
    description: "Alert when API traffic exceeds the normal range.",
    checked: false,
  },
]

function PrefRow({
  pref,
  onToggle,
}: {
  pref: Pref
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{pref.label}</p>
        <p className="text-xs text-muted-foreground">{pref.description}</p>
      </div>
      <Switch
        checked={pref.checked}
        onCheckedChange={(checked) => onToggle(pref.id, checked)}
        aria-label={pref.label}
      />
    </li>
  )
}

export function NotificationsTab() {
  const [email, setEmail] = useState<Pref[]>(EMAIL_PREFS)
  const [inApp, setInApp] = useState<Pref[]>(INAPP_PREFS)

  function toggle(
    setter: React.Dispatch<React.SetStateAction<Pref[]>>,
    id: string,
    checked: boolean
  ) {
    setter((prev) => prev.map((p) => (p.id === id ? { ...p, checked } : p)))
    toast.success(`${checked ? "Enabled" : "Disabled"} notifications`)
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Email notifications"
        description="Messages we send to your inbox."
      >
        <ul className="flex flex-col divide-y divide-border">
          {email.map((pref) => (
            <PrefRow
              key={pref.id}
              pref={pref}
              onToggle={(id, checked) => toggle(setEmail, id, checked)}
            />
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        title="In-app notifications"
        description="What you see inside the dashboard."
      >
        <ul className="flex flex-col divide-y divide-border">
          {inApp.map((pref) => (
            <PrefRow
              key={pref.id}
              pref={pref}
              onToggle={(id, checked) => toggle(setInApp, id, checked)}
            />
          ))}
        </ul>
      </SettingsSection>
    </div>
  )
}
