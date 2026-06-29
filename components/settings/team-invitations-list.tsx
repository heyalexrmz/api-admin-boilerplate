"use client"

import { useState, useTransition } from "react"
import { Clock, LoaderCircle, Mail, X } from "lucide-react"

import { cancelInvitation } from "@/app/actions/organization"
import { type TeamInvitation } from "@/app/lib/definitions"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { RoleBadge } from "@/components/settings/role-badge"
import { formatRelativeTime } from "@/lib/format"

export function TeamInvitationsList({
  invitations,
  onCanceled,
}: {
  invitations: TeamInvitation[]
  onCanceled: (id: string) => void
}) {
  const [pendingId, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCancel(id: string) {
    if (pendingId) return
    setError(null)
    startTransition(async () => {
      const res = await cancelInvitation(id)
      if ("error" in res) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      toast.success("Invitation canceled")
      onCanceled(id)
    })
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {invitations.map((invite) => (
        <li
          key={invite.id}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Mail />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {invite.email}
                <RoleBadge role={invite.role} className="text-[10px]" />
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Clock className="size-3" />
                Sent {formatRelativeTime(invite.createdAt)}
                {invite.expiresAt
                  ? ` · expires ${formatRelativeTime(invite.expiresAt)}`
                  : null}
              </p>
            </div>
          </div>
          {invite.canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={pendingId}
              onClick={() => handleCancel(invite.id)}
            >
              {pendingId ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <X />
              )}
              Cancel
            </Button>
          )}
        </li>
      ))}
      {error && (
        <li className="pt-3 text-sm text-destructive">{error}</li>
      )}
    </ul>
  )
}
