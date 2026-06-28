"use client"

import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Sun } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { SettingsSection } from "@/components/settings/settings-section"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function AppearanceTab() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const synced = theme === "system"

  function choose(value: string) {
    setTheme(value)
    toast.success(`Theme set to ${value}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Theme"
        description="Choose how the dashboard looks. System follows your OS setting."
      >
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((opt) => {
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                aria-pressed={active}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "border-ring bg-muted"
                    : "border-input hover:bg-muted/50"
                )}
              >
                <opt.icon className="size-5" />
                <span className="text-sm font-medium">{opt.label}</span>
                {active && (
                  <span className="absolute top-1.5 right-1.5 text-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Currently rendered in{" "}
          <span className="font-medium text-foreground">
            {resolvedTheme ?? "system"}
          </span>{" "}
          mode.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Sync with system"
        description="When on, the theme automatically follows your operating system and updates as it changes."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">
              {synced ? "Following system preference" : "Using a fixed theme"}
            </p>
            <p className="text-xs text-muted-foreground">
              {synced
                ? "Turn off to pin the current theme."
                : "Turn on to let your OS decide."}
            </p>
          </div>
          <Switch
            checked={synced}
            onCheckedChange={(checked) => {
              if (checked) {
                setTheme("system")
                toast.success("Theme synced with system")
              } else {
                setTheme(resolvedTheme ?? "light")
                toast.success("Pinned current theme")
              }
            }}
            aria-label="Sync theme with system"
          />
        </div>
      </SettingsSection>
    </div>
  )
}
