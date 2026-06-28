"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "@/lib/toast"
import { KeyRound, LoaderCircle, Sparkles } from "lucide-react"

import { createApiKey } from "@/app/actions/api-keys"
import {
  API_KEY_EXPIRIES,
  API_KEY_SCOPES,
  ApiKeyExpiryLabels,
  ApiKeyScopeLabels,
  type ApiKey,
  type NewApiKey,
} from "@/app/lib/definitions"
import { ApiKeySecretReveal } from "@/components/api-key-secret-reveal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  return `sk_live_${"•".repeat(8)}${secret.slice(-4)}`
}

function toApiKey(k: NewApiKey): ApiKey {
  return {
    id: k.id,
    name: k.name,
    preview: maskSecret(k.secret),
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
  const scopesErrorId = useId()

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
        <Label htmlFor={nameId}>Key name</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoFocus
          required
          maxLength={40}
          placeholder="Production server"
          aria-invalid={!!state?.errors?.name}
          aria-describedby={state?.errors?.name ? nameErrorId : undefined}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          Name it after where it&apos;s used, so rogue keys are easy to spot.
        </p>
        {state?.errors?.name?.[0] && (
          <p id={nameErrorId} className="text-sm text-destructive">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Scopes</legend>
        <p className="text-xs text-muted-foreground">
          Grant the least privilege the integration needs.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {API_KEY_SCOPES.map((scope) => (
            <label
              key={scope}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm transition-colors has-checked:border-ring has-checked:bg-muted"
            >
              <Checkbox
                name="scopes"
                value={scope}
                defaultChecked={scope === "read"}
              />
              {ApiKeyScopeLabels[scope]}
            </label>
          ))}
        </div>
        {state?.errors?.scopes?.[0] && (
          <p id={scopesErrorId} className="text-sm text-destructive">
            {state.errors.scopes[0]}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key-expiry">Expiry</Label>
        <Select name="expiry" defaultValue="30d" required>
          <SelectTrigger id="api-key-expiry" className="h-10 w-full">
            <SelectValue placeholder="Choose an expiry" />
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
          Short-lived keys are safer. You can rotate anytime.
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
          Creating…
        </>
      ) : (
        <>
          <Sparkles />
          Create key
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
    toast.success("API key created", {
      description: "Copy it now — it won't be shown again.",
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
          Create API key
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
                API key created
              </DialogTitle>
              <DialogDescription>
                Your key for{" "}
                <span className="font-medium text-foreground">
                  {createdKey.name}
                </span>{" "}
                is ready.
              </DialogDescription>
            </DialogHeader>

            <ApiKeySecretReveal
              secret={createdKey.secret}
              onDone={() => setOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Generate a scoped key for your application or integration.
              </DialogDescription>
            </DialogHeader>
            <CreateForm key={formKey} onCreated={handleCreated} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
