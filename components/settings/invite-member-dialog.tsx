"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle, Mail, Send } from "lucide-react"

import { inviteMember } from "@/app/actions/organization"
import {
  INVITABLE_ROLES,
  OrganizationRoleLabels,
  type TeamInvitation,
} from "@/app/lib/definitions"
import { toast } from "@/lib/toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function InviteSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 transition-transform active:scale-[0.96]"
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Sending invite…
        </>
      ) : (
        <>
          <Send />
          Send invite
        </>
      )}
    </Button>
  )
}

function InviteForm({
  onInvited,
  onDone,
}: {
  onInvited: (invitation: TeamInvitation) => void
  onDone: () => void
}) {
  const [state, action] = useActionState(inviteMember, undefined)
  const emailId = useId()
  const roleErrorId = useId()

  useEffect(() => {
    if (state?.invitation) {
      onInvited(state.invitation)
      toast.success("Invitation sent", {
        description: `We emailed ${state.invitation.email} a link to join.`,
      })
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.invitation])

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Work email</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={emailId}
            name="email"
            type="email"
            autoFocus
            required
            autoComplete="email"
            placeholder="teammate@company.com"
            aria-invalid={!!state?.errors?.email}
            className="h-10 pl-9"
          />
        </div>
        {state?.errors?.email?.[0] && (
          <p className="text-sm text-destructive">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select name="role" defaultValue="member" required>
          <SelectTrigger id="invite-role" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITABLE_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {OrganizationRoleLabels[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Admins can manage members, keys, and settings. Members can view the
          dashboard.
        </p>
        {state?.errors?.role?.[0] && (
          <p id={roleErrorId} className="text-sm text-destructive">
            {state.errors.role[0]}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-10">
            Cancel
          </Button>
        </DialogClose>
        <InviteSubmitButton />
      </DialogFooter>
    </form>
  )
}

export function InviteMemberDialog({
  onInvited,
  canInvite,
}: {
  onInvited: (invitation: TeamInvitation) => void
  canInvite: boolean
}) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="h-9 gap-1.5 transition-transform active:scale-[0.96]"
          disabled={!canInvite}
        >
          <Send />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              We&apos;ll email them a link to accept and join this workspace.
            </DialogDescription>
          </DialogHeader>
          <InviteForm
            key={formKey}
            onInvited={onInvited}
            onDone={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
