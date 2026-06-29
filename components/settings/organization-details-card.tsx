"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { toast } from "@/lib/toast"

import { updateOrganizationDetails } from "@/app/actions/organization"
import type { OrganizationDetails } from "@/app/lib/definitions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/settings/field"
import { SaveButton } from "@/components/settings/save-button"
import { SettingsSection } from "@/components/settings/settings-section"

function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function OrganizationDetailsCard({
  organization,
  canManage,
}: {
  organization: OrganizationDetails
  canManage: boolean
}) {
  const [state, action] = useActionState(updateOrganizationDetails, undefined)
  const [name, setName] = useState(organization.name)

  const nameId = useId()
  const slugId = useId()

  const savedName = state?.success ? state.name ?? "" : organization.name
  const hasChanges = name.trim() !== savedName.trim() && name.trim().length > 0

  useEffect(() => {
    if (state?.success) toast.success("Organization updated")
  }, [state])

  return (
    <SettingsSection
      title="Organization details"
      description="This name appears across the dashboard and in invitations."
      footer={canManage ? <SaveButton disabled={!hasChanges} /> : undefined}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-14 rounded-lg" size="lg">
          <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            {orgInitials(name || organization.name)}
          </AvatarFallback>
        </Avatar>
        <div className="text-sm text-muted-foreground">
          Your organization logo is generated from its initials. Image upload
          isn&apos;t available yet.
        </div>
      </div>

      {canManage ? (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <Field
            id={nameId}
            label="Organization name"
            error={state?.errors?.name?.[0]}
          >
            <Input
              id={nameId}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              className="h-10"
            />
          </Field>
          <Field
            id={slugId}
            label="Slug"
            description="The unique identifier for this workspace. It can't be changed here."
          >
            <Input
              id={slugId}
              type="text"
              readOnly
              value={organization.slug}
              tabIndex={-1}
              className="h-10 bg-muted/40 font-mono text-sm text-muted-foreground"
            />
          </Field>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id={nameId} label="Organization name">
            <Input
              id={nameId}
              type="text"
              readOnly
              value={organization.name}
              tabIndex={-1}
              className="h-10 bg-muted/40 text-muted-foreground"
            />
          </Field>
          <Field id={slugId} label="Slug">
            <Input
              id={slugId}
              type="text"
              readOnly
              value={organization.slug}
              tabIndex={-1}
              className="h-10 bg-muted/40 font-mono text-sm text-muted-foreground"
            />
          </Field>
        </div>
      )}

      {state?.message && !state.success && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </SettingsSection>
  )
}
