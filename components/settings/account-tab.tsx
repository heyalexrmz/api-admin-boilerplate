"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { toast } from "@/lib/toast"

import { updateProfile } from "@/app/actions/settings"
import type { SettingsUser } from "@/app/lib/definitions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { DangerZoneSection } from "@/components/settings/danger-zone-section"
import { Field } from "@/components/settings/field"
import { SaveButton } from "@/components/settings/save-button"
import { SettingsSection } from "@/components/settings/settings-section"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AccountTab({ user }: { user: SettingsUser }) {
  const [state, action] = useActionState(updateProfile, undefined)
  const [firstName, setFirstName] = useState(user.firstName ?? "")
  const [lastName, setLastName] = useState(user.lastName ?? "")

  const firstNameId = useId()
  const lastNameId = useId()
  const emailId = useId()

  const fullName = `${firstName} ${lastName}`.trim()
  const savedFirstName = state?.success ? state.firstName ?? "" : user.firstName ?? ""
  const savedLastName = state?.success ? state.lastName ?? "" : user.lastName ?? ""
  const hasChanges = firstName !== savedFirstName || lastName !== savedLastName

  useEffect(() => {
    if (state?.success) toast.success("Profile updated")
  }, [state])

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <SettingsSection
          title="Account details"
          description="This is how others will see you across the workspace."
          footer={<SaveButton disabled={!hasChanges} />}
        >
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm">
                {initials(fullName) || "—"}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              Your avatar is generated from your initials.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={firstNameId}
              label="First name"
              error={state?.errors?.firstName?.[0]}
            >
              <Input
                id={firstNameId}
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={60}
                required
                autoComplete="given-name"
                className="h-10"
              />
            </Field>

            <Field
              id={lastNameId}
              label="Last name"
              error={state?.errors?.lastName?.[0]}
            >
              <Input
                id={lastNameId}
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={60}
                required
                autoComplete="family-name"
                className="h-10"
              />
            </Field>
          </div>

          <Field
            id={emailId}
            label="Work email"
            description="Your sign-in email. Magic link only — contact support to change it."
          >
            <Input
              id={emailId}
              type="email"
              readOnly
              value={user.email}
              autoComplete="email"
              className="h-10 bg-muted/40 text-muted-foreground"
              tabIndex={-1}
            />
          </Field>
        </SettingsSection>
      </form>

      <DangerZoneSection userEmail={user.email} />
    </div>
  )
}
