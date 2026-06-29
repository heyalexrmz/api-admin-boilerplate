"use client"

import { useState, useTransition } from "react"
import { LoaderCircle, UserMinus } from "lucide-react"

import { removeMember } from "@/app/actions/organization"
import type { TeamMember } from "@/app/lib/definitions"
import { toast } from "@/lib/toast"
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

export function RemoveMemberDialog({
  member,
  open,
  onOpenChange,
  onRemoved,
}: {
  member: TeamMember
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRemove() {
    if (isPending) return
    setError(null)
    startTransition(async () => {
      const res = await removeMember(member.id)
      if ("error" in res) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      toast.success("Member removed", {
        description: `${member.name} no longer has access to this workspace.`,
      })
      onRemoved(member.id)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-destructive/15 text-destructive">
              <UserMinus className="size-4" />
            </span>
            Remove member
          </DialogTitle>
          <DialogDescription>
            Remove{" "}
            <span className="font-medium text-foreground">{member.name}</span>{" "}
            ({member.email}) from this workspace. They&apos;ll lose access
            immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRemove}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Removing…
              </>
            ) : (
              "Remove member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
