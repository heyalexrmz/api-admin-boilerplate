"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { toast } from "@/lib/toast"

import { updateProfile } from "@/app/actions/settings"
import { TIMEZONES } from "@/app/lib/definitions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

export function AccountTab() {
  const [state, action] = useActionState(updateProfile, undefined)
  const [name, setName] = useState("Jane Doe")

  const nameId = useId()
  const emailId = useId()
  const timezoneId = useId()
  const bioId = useId()

  useEffect(() => {
    if (state?.success) toast.success("Profile updated")
  }, [state])

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <SettingsSection
          title="Account details"
          description="This is how others will see you across the workspace."
        >
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm">
                {initials(name) || "—"}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              Your avatar is generated from your initials.
            </div>
          </div>

          <Field
            id={nameId}
            label="Full name"
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
            id={emailId}
            label="Work email"
            error={state?.errors?.email?.[0]}
          >
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="jane@company.com"
              required
              className="h-10"
            />
          </Field>
        </SettingsSection>

        <SettingsSection
          title="Preferences"
          description="Localize your experience and tell people a bit about you."
          footer={<SaveButton />}
        >
          <Field
            id={timezoneId}
            label="Timezone"
            error={state?.errors?.timezone?.[0]}
            description="Used for emails, logs, and scheduling."
          >
            <Select name="timezone" defaultValue="America/Chicago" required>
              <SelectTrigger id={timezoneId} className="h-10 w-full">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            id={bioId}
            label="Bio"
            error={state?.errors?.bio?.[0]}
            description="Up to 160 characters."
          >
            <Textarea
              id={bioId}
              name="bio"
              maxLength={160}
              defaultValue="Building APIs at Acme."
              className="min-h-20"
            />
          </Field>
        </SettingsSection>
      </form>

      <DangerZoneSection />
    </div>
  )
}
