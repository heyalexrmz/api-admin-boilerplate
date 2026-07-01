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
import { getOrgColor, orgInitials } from "@/lib/org-branding"

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
  const accentColor = getOrgColor(organization)

  useEffect(() => {
    if (state?.success) toast.success("Organización actualizada")
  }, [state])

  const details = (
    <SettingsSection
      title="Datos de la organización"
      description="Este nombre aparece en el panel y en las invitaciones."
      footer={canManage ? <SaveButton disabled={!hasChanges} /> : undefined}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-14 rounded-lg" size="lg">
          <AvatarFallback
            className="rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {orgInitials(name || organization.name)}
          </AvatarFallback>
        </Avatar>
        <div className="text-sm text-muted-foreground">
          El logo de tu organización se genera con sus iniciales. La carga de imagen
          aún no está disponible.
        </div>
      </div>

      <Field
        id={nameId}
        label="Nombre de la organización"
        error={state?.errors?.name?.[0]}
      >
        <Input
          id={nameId}
          name="name"
          value={name}
          onChange={canManage ? (e) => setName(e.target.value) : undefined}
          readOnly={!canManage}
          maxLength={60}
          required={canManage}
          tabIndex={canManage ? undefined : -1}
          className={
            canManage
              ? "h-10"
              : "h-10 bg-muted/40 text-muted-foreground"
          }
        />
      </Field>
      <Field
        id={slugId}
        label="Slug"
        description={
          canManage
            ? "El identificador único de este espacio. No se puede cambiar aquí."
            : undefined
        }
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

      {state?.message && !state.success && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </SettingsSection>
  )

  if (!canManage) {
    return details
  }

  return (
    <form action={action} noValidate>
      {details}
    </form>
  )
}
