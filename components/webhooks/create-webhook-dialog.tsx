"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle, Sparkles, Webhook as WebhookIcon } from "lucide-react"

import { createWebhook } from "@/app/actions/webhooks"
import {
  WEBHOOK_EVENTS,
  WebhookEventLabels,
  type NewWebhook,
  type Webhook,
} from "@/app/lib/definitions"
import { WebhookSecretReveal } from "@/components/webhooks/webhook-secret-reveal"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"

function maskSecret(secret: string): string {
  return `whsec_${"•".repeat(8)}${secret.slice(-4)}`
}

function toWebhook(w: NewWebhook): Webhook {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    description: w.description,
    events: w.events,
    enabled: w.enabled,
    secretPreview: maskSecret(w.secret),
    createdAt: w.createdAt,
    updatedAt: w.createdAt,
    lastFiredAt: null,
    lastRotatedAt: w.lastRotatedAt,
    status: "active",
  }
}

function CreateForm({ onCreated }: { onCreated: (webhook: NewWebhook) => void }) {
  const [state, action] = useActionState(createWebhook, undefined)

  const nameId = useId()
  const urlId = useId()
  const descriptionId = useId()
  const nameErrorId = useId()
  const urlErrorId = useId()
  const eventsErrorId = useId()

  useEffect(() => {
    if (state?.webhook) onCreated(state.webhook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.webhook])

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoFocus
          required
          maxLength={40}
          placeholder="Billing service"
          aria-invalid={!!state?.errors?.name}
          aria-describedby={state?.errors?.name ? nameErrorId : undefined}
          className="h-10"
        />
        {state?.errors?.name?.[0] && (
          <p id={nameErrorId} className="text-sm text-destructive">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={urlId}>Endpoint URL</Label>
        <Input
          id={urlId}
          name="url"
          type="url"
          required
          inputMode="url"
          placeholder="https://example.com/webhooks"
          aria-invalid={!!state?.errors?.url}
          aria-describedby={state?.errors?.url ? urlErrorId : undefined}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll POST event payloads to this URL. Must be HTTPS.
        </p>
        {state?.errors?.url?.[0] && (
          <p id={urlErrorId} className="text-sm text-destructive">
            {state.errors.url[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={descriptionId}>Description</Label>
        <Textarea
          id={descriptionId}
          name="description"
          maxLength={160}
          placeholder="What this webhook is for (optional)"
          className="min-h-20"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Events</legend>
        <p className="text-xs text-muted-foreground">
          Choose which events trigger this webhook.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {WEBHOOK_EVENTS.map((event) => (
            <label
              key={event}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm transition-colors has-checked:border-ring has-checked:bg-muted"
            >
              <Checkbox name="events" value={event} defaultChecked={event === "api_key.created"} />
              {WebhookEventLabels[event]}
              <code className="ml-auto font-mono text-xs text-muted-foreground">
                {event}
              </code>
            </label>
          ))}
        </div>
        {state?.errors?.events?.[0] && (
          <p id={eventsErrorId} className="text-sm text-destructive">
            {state.errors.events[0]}
          </p>
        )}
      </fieldset>

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
          Create webhook
        </>
      )}
    </Button>
  )
}

export function CreateWebhookDialog({
  onCreated,
}: {
  onCreated: (webhook: Webhook) => void
}) {
  const [open, setOpen] = useState(false)
  const [createdWebhook, setCreatedWebhook] = useState<NewWebhook | null>(null)
  const [formKey, setFormKey] = useState(0)

  function handleCreated(webhook: NewWebhook) {
    setCreatedWebhook(webhook)
    onCreated(toWebhook(webhook))
    toast.success("Webhook created", {
      description: "Copy the signing secret now — it won't be shown again.",
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreatedWebhook(null)
      setFormKey((k) => k + 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 transition-transform active:scale-[0.96]">
          <WebhookIcon />
          Create webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {createdWebhook ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </span>
                Webhook created
              </DialogTitle>
              <DialogDescription>
                Your webhook for{" "}
                <span className="font-medium text-foreground">
                  {createdWebhook.name}
                </span>{" "}
                is ready.
              </DialogDescription>
            </DialogHeader>

            <WebhookSecretReveal
              secret={createdWebhook.secret}
              onDone={() => setOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create webhook</DialogTitle>
              <DialogDescription>
                Receive event payloads at an HTTPS endpoint you control.
              </DialogDescription>
            </DialogHeader>
            <CreateForm key={formKey} onCreated={handleCreated} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
