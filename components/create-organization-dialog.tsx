"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { LoaderCircle, Sparkles } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { slugify } from "@/lib/slugify"
import { toast } from "@/lib/toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const nameId = useId()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const slug = slugify(name)

  useEffect(() => {
    if (!open) {
      setName("")
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Enter an organization name.")
      return
    }
    if (!slug) {
      setError("Choose a name with letters or numbers.")
      return
    }

    startTransition(async () => {
      const { error: createError } = await authClient.organization.create({
        name: name.trim(),
        slug,
      })
      if (createError) {
        const message = createError.message ?? "Could not create the workspace."
        if (/slug|exists|taken|unique/i.test(message)) {
          setError("That workspace name is taken. Try another.")
        } else {
          setError(message)
        }
        return
      }

      const { error: activeError } = await authClient.organization.setActive({
        organizationSlug: slug,
      })
      if (activeError) {
        toast.error("Workspace created, but we couldn't switch to it.")
      } else {
        toast.success("Workspace created")
      }
      onOpenChange(false)
      // Hard reload so the dashboard remounts scoped to the new workspace,
      // avoiding any stale state from the previously active org.
      window.location.reload()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
            <DialogDescription>
              Spin up another organization for a different team or project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>Workspace name</Label>
              <Input
                id={nameId}
                type="text"
                autoFocus
                required
                minLength={2}
                maxLength={60}
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  Slug:{" "}
                  <span className="font-medium text-foreground">{slug}</span>
                </p>
              )}
            </div>

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
                  Create workspace
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
