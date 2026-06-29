"use client"

import { useId, useState, useTransition } from "react"
import { LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react"

import { rotateWebhookSecret } from "@/app/actions/webhooks"
import type { RotatedWebhookSecret, Webhook } from "@/app/lib/definitions"
import { WebhookSecretReveal } from "@/components/webhooks/webhook-secret-reveal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { toast } from "@/lib/toast"

export function RotateWebhookDialog({
  webhook,
  open,
  onOpenChange,
  onRotated,
}: {
  webhook: Webhook
  open: boolean
  onOpenChange: (open: boolean) => void
  onRotated: (id: string, preview: string, lastRotatedAt: string) => void
}) {
  const [confirmText, setConfirmText] = useState("")
  const [rotated, setRotated] = useState<RotatedWebhookSecret | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputId = useId()

  const matches = confirmText.trim() === webhook.name

  function handleRotate() {
    if (!matches || isPending) return
    startTransition(async () => {
      const res = await rotateWebhookSecret(webhook.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onRotated(webhook.id, res.secret.preview, res.secret.lastRotatedAt)
      setRotated(res.secret)
      toast.success("Signing secret rotated", {
        description: "The previous secret no longer works.",
      })
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmText("")
      setRotated(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {rotated ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="size-4" />
                </span>
                Signing secret rotated
              </DialogTitle>
              <DialogDescription>
                The new secret for{" "}
                <span className="font-medium text-foreground">
                  {webhook.name}
                </span>{" "}
                is ready. The old one is invalid.
              </DialogDescription>
            </DialogHeader>

            <WebhookSecretReveal
              secret={rotated.secret}
              onDone={() => onOpenChange(false)}
              doneLabel="I've saved my secret"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="size-4" />
                </span>
                Rotate signing secret
              </DialogTitle>
              <DialogDescription>
                Generate a new signing secret for{" "}
                <span className="font-medium text-foreground">
                  {webhook.name}
                </span>
                . The URL and subscribed events stay the same.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <ShieldAlert />
              <AlertTitle>Any endpoint using the old secret will break</AlertTitle>
              <AlertDescription>
                Rotation is immediate. Update your receiver with the new secret
                right after you copy it.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <Label htmlFor={inputId} className="select-text">
                Type{" "}
                <span className="font-medium text-foreground">
                  {webhook.name}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id={inputId}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={webhook.name}
                autoComplete="off"
                autoFocus
                className="h-10"
                disabled={isPending}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleRotate}
                disabled={!matches || isPending}
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Rotating…
                  </>
                ) : (
                  <>
                    <RefreshCw />
                    Rotate secret
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
