"use client"

import { useActionState, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle, ShieldAlert, Trash2 } from "lucide-react"

import { deleteAccount } from "@/app/actions/settings"
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
import { Field } from "@/components/settings/field"
import { SettingsSection } from "@/components/settings/settings-section"

// Matches the signed-in user (would come from the session on the server).
const EMAIL = "jane@company.com"

function DeleteSubmitButton({ matches }: { matches: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={!matches || pending}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Deleting…
        </>
      ) : (
        <>
          <Trash2 />
          Delete account
        </>
      )}
    </Button>
  )
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, action] = useActionState(deleteAccount, undefined)
  const [confirmText, setConfirmText] = useState("")
  const inputId = useId()
  const matches = confirmText.trim().toLowerCase() === EMAIL.toLowerCase()

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
            Delete account
          </DialogTitle>
          <DialogDescription>
            This permanently removes your account and all associated data.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>This can&apos;t be undone</AlertTitle>
          <AlertDescription>
            All API keys, logs, and billing history will be erased immediately.
          </AlertDescription>
        </Alert>

        <form action={action} className="flex flex-col gap-4">
          <Field
            id={inputId}
            label={
              <>
                Type{" "}
                <span className="font-medium text-foreground">{EMAIL}</span>{" "}
                to confirm
              </>
            }
            error={state?.message}
          >
            <Input
              id={inputId}
              name="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={EMAIL}
              autoComplete="off"
              autoFocus
              className="h-10"
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <DeleteSubmitButton matches={matches} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DangerZoneSection() {
  const [open, setOpen] = useState(false)

  return (
    <SettingsSection
      title="Delete account"
      description="Permanently remove your account and all data tied to it. This is irreversible."
      isDanger
      footer={
        <Button
          type="button"
          variant="destructive"
          className="h-9"
          onClick={() => setOpen(true)}
        >
          <Trash2 />
          Delete account
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        You&apos;ll be asked to confirm your email before anything is removed.
      </p>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </SettingsSection>
  )
}
