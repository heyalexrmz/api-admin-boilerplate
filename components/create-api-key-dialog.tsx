"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "@/lib/toast"
import { KeyRound, LoaderCircle, Sparkles } from "lucide-react"

import { createApiKey } from "@/app/actions/api-keys"
import {
  API_KEY_EXPIRIES,
  API_KEY_MODES,
  ApiKeyExpiryLabels,
  ApiKeyModeLabels,
  type ApiKey,
  type NewApiKey,
} from "@/app/lib/definitions"
import { ApiKeySecretReveal } from "@/components/api-key-secret-reveal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function maskSecret(secret: string): string {
  const prefix = secret.startsWith("sk_test_") ? "sk_test_" : "sk_live_"
  return `${prefix}${"•".repeat(8)}${secret.slice(-4)}`
}

function toApiKey(k: NewApiKey): ApiKey {
  return {
    id: k.id,
    name: k.name,
    preview: maskSecret(k.secret),
    mode: k.mode,
    scopes: k.scopes,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    lastRotatedAt: k.lastRotatedAt,
    status: "active",
  }
}

function CreateForm({
  onCreated,
}: {
  onCreated: (key: NewApiKey) => void
}) {
  const [state, action] = useActionState(createApiKey, undefined)

  const nameId = useId()
  const nameErrorId = useId()

  useEffect(() => {
    if (state?.key) onCreated(state.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.key])

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Nombre de la llave</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoFocus
          required
          maxLength={40}
          placeholder="Servidor de producción"
          aria-invalid={!!state?.errors?.name}
          aria-describedby={state?.errors?.name ? nameErrorId : undefined}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          Nómbrala según dónde se usa para identificar llaves sospechosas fácilmente.
        </p>
        {state?.errors?.name?.[0] && (
          <p id={nameErrorId} className="text-sm text-destructive">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key-mode">Modo</Label>
        <Select name="mode" defaultValue="live" required>
          <SelectTrigger id="api-key-mode" className="h-10 w-full">
            <SelectValue placeholder="Elige un modo" />
          </SelectTrigger>
          <SelectContent>
            {API_KEY_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {ApiKeyModeLabels[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Las llaves sandbox procesan pruebas y nunca llaman al proveedor upstream.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key-expiry">Expiración</Label>
        <Select name="expiry" defaultValue="30d" required>
          <SelectTrigger id="api-key-expiry" className="h-10 w-full">
            <SelectValue placeholder="Elige una expiración" />
          </SelectTrigger>
          <SelectContent>
            {API_KEY_EXPIRIES.map((expiry) => (
              <SelectItem key={expiry} value={expiry}>
                {ApiKeyExpiryLabels[expiry]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Las llaves de corta duración son más seguras. Puedes rotarlas en cualquier momento.
        </p>
      </div>

      <CreateSubmitButton />
    </form>
  )
}

function CreateSubmitButton() {
  const { pending } = useFormStatus()
  return (
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
          Crear llave
        </>
      )}
    </Button>
  )
}

export function CreateApiKeyDialog({
  onCreated,
}: {
  onCreated: (key: ApiKey) => void
}) {
  const [open, setOpen] = useState(false)
  const [createdKey, setCreatedKey] = useState<NewApiKey | null>(null)
  const [formKey, setFormKey] = useState(0)

  function handleCreated(key: NewApiKey) {
    setCreatedKey(key)
    onCreated(toApiKey(key))
    toast.success("Llave API creada", {
      description: "Cópiala ahora; no volverá a mostrarse.",
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreatedKey(null)
      setFormKey((k) => k + 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 transition-transform active:scale-[0.96]">
          <KeyRound />
          Crear llave API
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {createdKey ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </span>
                Llave API creada
              </DialogTitle>
              <DialogDescription>
                Tu llave para{" "}
                <span className="font-medium text-foreground">
                  {createdKey.name}
                </span>{" "}
                está lista.
              </DialogDescription>
            </DialogHeader>

            <ApiKeySecretReveal
              secret={createdKey.secret}
              onDone={() => handleOpenChange(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Crear llave API</DialogTitle>
              <DialogDescription>
                Genera una llave con permisos específicos para tu aplicación o integración.
              </DialogDescription>
            </DialogHeader>
            <CreateForm key={formKey} onCreated={handleCreated} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
