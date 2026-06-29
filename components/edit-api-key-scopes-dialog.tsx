"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle } from "lucide-react"

import { updateApiKeyScopes } from "@/app/actions/api-keys"
import {
  API_KEY_SCOPES,
  ApiKeyScopeLabels,
  type ApiKey,
  type ApiKeyScope,
  type UpdateApiKeyScopesState,
} from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/lib/toast"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Saving…
        </>
      ) : (
        "Save access"
      )}
    </Button>
  )
}

export function EditApiKeyScopesDialog({
  apiKey,
  open,
  onOpenChange,
  onUpdated,
}: {
  apiKey: ApiKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (id: string, scopes: ApiKeyScope[]) => void
}) {
  const [state, action] = useActionState<UpdateApiKeyScopesState, FormData>(
    updateApiKeyScopes,
    undefined
  )

  useEffect(() => {
    if (state?.scopes) {
      onUpdated(apiKey.id, state.scopes)
      toast.success("Scopes updated")
      onOpenChange(false)
    }
  }, [apiKey.id, onOpenChange, onUpdated, state?.scopes])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit access</DialogTitle>
          <DialogDescription>
            Adjust access for {apiKey.name}. API keys currently use one general permission.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={apiKey.id} />
          <div className="grid grid-cols-1 gap-2">
            {API_KEY_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm transition-colors has-checked:border-ring has-checked:bg-muted"
              >
                <Checkbox
                  name="scopes"
                  value={scope}
                  defaultChecked={apiKey.scopes.includes(scope)}
                />
                {ApiKeyScopeLabels[scope]}
              </label>
            ))}
          </div>
          {state?.errors?.scopes?.[0] && (
            <p className="text-sm text-destructive">{state.errors.scopes[0]}</p>
          )}
          {state?.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
