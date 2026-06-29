"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle, Pencil } from "lucide-react"

import { updateWebhook } from "@/app/actions/webhooks"
import {
  WEBHOOK_EVENTS,
  WebhookEventLabels,
  type UpdateWebhookState,
  type UpdatedWebhook,
  type Webhook,
  type WebhookEvent,
} from "@/app/lib/definitions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Saving…
        </>
      ) : (
        "Save changes"
      )}
    </Button>
  )
}

function EditForm({
  webhook,
  onUpdated,
}: {
  webhook: Webhook
  onUpdated: (updated: UpdatedWebhook) => void
}) {
  const [state, action] = useActionState<UpdateWebhookState, FormData>(
    updateWebhook,
    undefined
  )

  const nameId = useId()
  const urlId = useId()
  const descriptionId = useId()
  const nameErrorId = useId()
  const urlErrorId = useId()
  const eventsErrorId = useId()
  const [name, setName] = useState(webhook.name)
  const [url, setUrl] = useState(webhook.url)
  const [description, setDescription] = useState(webhook.description ?? "")
  const [events, setEvents] = useState<WebhookEvent[]>(webhook.events)
  const hasChanges =
    name !== webhook.name ||
    url !== webhook.url ||
    description !== (webhook.description ?? "") ||
    events.length !== webhook.events.length ||
    events.some((event) => !webhook.events.includes(event))

  function toggleEvent(event: WebhookEvent, checked: boolean) {
    setEvents((prev) =>
      checked ? [...prev, event] : prev.filter((value) => value !== event)
    )
  }

  useEffect(() => {
    if (state?.webhook) {
      onUpdated(state.webhook)
      toast.success("Webhook updated", {
        description: state.webhook.name,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.webhook])

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="id" value={webhook.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
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
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={!!state?.errors?.url}
          aria-describedby={state?.errors?.url ? urlErrorId : undefined}
          className="h-10"
        />
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
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this webhook is for (optional)"
          className="min-h-20"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Events</legend>
        <div className="grid grid-cols-1 gap-2">
          {WEBHOOK_EVENTS.map((event) => (
            <label
              key={event}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm transition-colors has-checked:border-ring has-checked:bg-muted"
            >
              <Checkbox
                name="events"
                value={event}
                checked={events.includes(event as WebhookEvent)}
                onCheckedChange={(checked) =>
                  toggleEvent(event as WebhookEvent, checked === true)
                }
              />
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

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton disabled={!hasChanges} />
      </DialogFooter>
    </form>
  )
}

export function EditWebhookDialog({
  webhook,
  open,
  onOpenChange,
  onUpdated,
}: {
  webhook: Webhook
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (id: string, updated: UpdatedWebhook) => void
}) {
  const [formKey, setFormKey] = useState(0)

  function handleUpdated(updated: UpdatedWebhook) {
    onUpdated(webhook.id, updated)
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) setFormKey((k) => k + 1)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Pencil className="size-4" />
            </span>
            Edit webhook
          </DialogTitle>
          <DialogDescription>
            Update the name, endpoint URL, or subscribed events.
          </DialogDescription>
        </DialogHeader>
        <EditForm key={formKey} webhook={webhook} onUpdated={handleUpdated} />
      </DialogContent>
    </Dialog>
  )
}
