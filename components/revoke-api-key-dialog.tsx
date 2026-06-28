"use client"

import { useId, useState, useTransition } from "react"
import { toast } from "@/lib/toast"
import { LoaderCircle, ShieldAlert } from "lucide-react"

import { revokeApiKey } from "@/app/actions/api-keys"
import type { ApiKey } from "@/app/lib/definitions"
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

export function RevokeApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
  onRevoked,
}: {
  apiKey: ApiKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onRevoked: (id: string) => void
}) {
  const [confirmText, setConfirmText] = useState("")
  const [isPending, startTransition] = useTransition()
  const inputId = useId()

  const matches = confirmText.trim() === apiKey.name

  function handleRevoke() {
    if (!matches || isPending) return
    startTransition(async () => {
      const res = await revokeApiKey(apiKey.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("API key revoked", {
        description: `${apiKey.name} can no longer authenticate requests.`,
      })
      onRevoked(apiKey.id)
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
              <ShieldAlert className="size-4" />
            </span>
            Revoke API key
          </DialogTitle>
          <DialogDescription>
            This permanently disables the key. Any service using it will fail
            immediately.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>This action can&apos;t be undone</AlertTitle>
          <AlertDescription>
            You&apos;ll need to create and distribute a new key to restore
            access.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId} className="select-text">
            Type{" "}
            <span className="font-medium text-foreground">{apiKey.name}</span>{" "}
            to confirm
          </Label>
          <Input
            id={inputId}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={apiKey.name}
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
            onClick={handleRevoke}
            disabled={!matches || isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Revoking…
              </>
            ) : (
              "Revoke key"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
