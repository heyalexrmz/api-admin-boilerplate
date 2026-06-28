"use client"

import Link from "next/link"
import { useActionState, useId } from "react"
import { ArrowLeft, Mail, TriangleAlert } from "lucide-react"

import { ssoLogin } from "@/app/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/submit-button"

export function SsoForm() {
  const [state, action] = useActionState(ssoLogin, undefined)
  const emailId = useId()
  const emailErrorId = useId()

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <TriangleAlert />
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
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@company.com"
            aria-invalid={!!state?.errors?.email}
            aria-describedby={state?.errors?.email ? emailErrorId : undefined}
            className="h-10 pl-9"
          />
        </div>
        {state?.errors?.email?.[0] && (
          <p id={emailErrorId} className="text-sm text-destructive">
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <SubmitButton
        label="Continue with SSO"
        pendingLabel="Redirecting to IdP…"
      />

      <Link
        href="/"
        className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </form>
  )
}
