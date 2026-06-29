"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { Check } from "lucide-react"

import { renameApiKey } from "@/app/actions/api-keys"
import type { ApiKey } from "@/app/lib/definitions"
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

function RenameSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      <Check />
      Save
    </Button>
  )
}

export function RenameApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
  onRenamed,
}: {
  apiKey: ApiKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed: (id: string, name: string) => void
}) {
  const [state, action] = useActionState(renameApiKey, undefined)
  const inputId = useId()
  const errorId = useId()
  const [value, setValue] = useState(apiKey.name)
  const hasChanges = value.trim() !== apiKey.name

  useEffect(() => {
    if (state?.name) {
      onRenamed(apiKey.id, state.name)
      toast.success("Key renamed")
      onOpenChange(false)
    }
  }, [state?.name])

  function handleOpenChange(next: boolean) {
    if (next) setValue(apiKey.name)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename API key</DialogTitle>
          <DialogDescription>
            Choose a clearer name for this key. The key itself isn&apos;t
            affected.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={apiKey.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>Key name</Label>
            <Input
              id={inputId}
              name="name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={40}
              autoFocus
              className="h-10"
              aria-invalid={!!state?.errors?.name}
              aria-describedby={state?.errors?.name ? errorId : undefined}
            />
            {state?.errors?.name?.[0] && (
              <p id={errorId} className="text-sm text-destructive">
                {state.errors.name[0]}
              </p>
            )}
            {state?.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <RenameSubmitButton disabled={!hasChanges} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
