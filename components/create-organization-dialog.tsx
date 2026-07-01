"use client"

import { useId, useState, useTransition } from "react"
import { LoaderCircle, Sparkles } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { slugify } from "@/lib/slugify"
import { toast } from "@/lib/toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const nameId = useId()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const slug = slugify(name)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Ingresa el nombre de la organización.")
      return
    }
    if (!slug) {
      setError("Elige un nombre con letras o números.")
      return
    }

    startTransition(async () => {
      const { error: createError } = await authClient.organization.create({
        name: name.trim(),
        slug,
      })
      if (createError) {
        const message = createError.message ?? "No pudimos crear el espacio."
        if (/slug|exists|taken|unique/i.test(message)) {
          setError("Ese nombre de espacio ya está en uso. Intenta con otro.")
        } else {
          setError(message)
        }
        return
      }

      const { error: activeError } = await authClient.organization.setActive({
        organizationSlug: slug,
      })
      if (activeError) {
        toast.error("El espacio se creó, pero no pudimos cambiar a él.")
      } else {
        toast.success("Espacio creado")
      }
      onOpenChange(false)
      // Hard reload so the dashboard remounts scoped to the new workspace,
      // avoiding any stale state from the previously active org.
      window.location.reload()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Crear un nuevo espacio</DialogTitle>
            <DialogDescription>
              Crea otra organización para un equipo o proyecto distinto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>Nombre del espacio</Label>
              <Input
                id={nameId}
                type="text"
                autoFocus
                required
                minLength={2}
                maxLength={60}
                placeholder="Taxo Timbre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  Slug:{" "}
                  <span className="font-medium text-foreground">{slug}</span>
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-10 w-full transition-transform active:scale-[0.96]"
            >
              {pending ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <Sparkles />
                  Crear espacio
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
