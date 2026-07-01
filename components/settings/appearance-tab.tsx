"use client"

import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Sun } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { SettingsSection } from "@/components/settings/settings-section"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const

export function AppearanceTab() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const synced = theme === "system"

  function choose(value: string) {
    setTheme(value)
    toast.success("Tema actualizado")
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Tema"
        description="Elige cómo se ve el panel. Sistema sigue la configuración de tu equipo."
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
          Actualmente se muestra en modo{" "}
          <span className="font-medium text-foreground">
            {resolvedTheme === "dark" ? "oscuro" : resolvedTheme === "light" ? "claro" : "sistema"}
          </span>{" "}
          .
        </p>
      </SettingsSection>

      <SettingsSection
        title="Sincronizar con el sistema"
        description="Cuando está activo, el tema sigue automáticamente la configuración de tu sistema operativo."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">
              {synced ? "Siguiendo la preferencia del sistema" : "Usando un tema fijo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {synced
                ? "Desactívalo para fijar el tema actual."
                : "Actívalo para que tu sistema decida."}
            </p>
          </div>
          <Switch
            checked={synced}
            onCheckedChange={(checked) => {
              if (checked) {
                setTheme("system")
                toast.success("Tema sincronizado con el sistema")
              } else {
                setTheme(resolvedTheme ?? "light")
                toast.success("Tema actual fijado")
              }
            }}
            aria-label="Sincronizar tema con el sistema"
          />
        </div>
      </SettingsSection>
    </div>
  )
}
