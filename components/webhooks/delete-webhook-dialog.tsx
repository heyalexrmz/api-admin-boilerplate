"use client"

import { useId, useState, useTransition } from "react"
import { LoaderCircle, Trash2 } from "lucide-react"

import { deleteWebhook } from "@/app/actions/webhooks"
import type { Webhook } from "@/app/lib/definitions"
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

export function DeleteWebhookDialog({
  webhook,
  open,
  onOpenChange,
  onDeleted,
}: {
  webhook: Webhook
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (id: string) => void
}) {
  const [confirmText, setConfirmText] = useState("")
  const [isPending, startTransition] = useTransition()
  const inputId = useId()

  const matches = confirmText.trim() === webhook.name

  function handleDelete() {
    if (!matches || isPending) return
    startTransition(async () => {
      const res = await deleteWebhook(webhook.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Webhook deleted", {
        description: `${webhook.name} and its event logs were removed.`,
      })
      onDeleted(webhook.id)
      setConfirmText("")
      onOpenChange(false)
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmText("")
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-destructive/15 text-destructive">
              <Trash2 className="size-4" />
            </span>
            Delete webhook
          </DialogTitle>
          <DialogDescription>
            This permanently removes the webhook and all of its event logs.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <Trash2 />
          <AlertTitle>This action can&apos;t be undone</AlertTitle>
          <AlertDescription>
            Event delivery to{" "}
            <span className="font-medium text-foreground">{webhook.url}</span>{" "}
            stops immediately, and delivery history is erased.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId} className="select-text">
            Type{" "}
            <span className="font-medium text-foreground">{webhook.name}</span>{" "}
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
            variant="destructive"
            onClick={handleDelete}
            disabled={!matches || isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 />
                Delete webhook
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
