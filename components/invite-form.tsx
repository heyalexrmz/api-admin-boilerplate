"use client"

import Link from "next/link"
import { useId, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  TriangleAlert,
  User,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type InviteFormProps = {
  invitationId: string
  email: string
  inviterName: string
  workspaceName: string
}

export function InviteForm({
  invitationId,
  email,
  inviterName,
  workspaceName,
}: InviteFormProps) {
  const nameId = useId()
  const emailId = useId()

  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await authClient.signIn.magicLink({
      email,
      name: name || undefined,
      callbackURL: `/invite/accept?invitationId=${encodeURIComponent(invitationId)}`,
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Could not send the sign-in link. Try again.")
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <CheckCircle2 />
          <AlertDescription>
            We sent a sign-in link to <strong className="font-medium">{sentTo}</strong>.
            Click the link in the email to accept your invite and join{" "}
            <strong className="font-medium">{workspaceName}</strong>.
          </AlertDescription>
        </Alert>
        <p className="text-center text-sm text-muted-foreground text-pretty">
          Didn&apos;t get the email? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
          >
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-pretty text-muted-foreground">
        <span className="font-medium text-foreground">{inviterName}</span> invited
        you to join{" "}
        <span className="font-medium text-foreground">{workspaceName}</span>.
      </div>

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
            defaultValue={email}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            className="h-10 bg-muted pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Full name</Label>
        <div className="relative">
          <User
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={nameId}
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="h-10 w-full transition-transform active:scale-[0.96]"
      >
        {loading ? (
          <>
            <LoaderCircle className="animate-spin" />
            Sending invite link…
          </>
        ) : (
          <>
            Accept invite
            <ArrowRight />
          </>
        )}
      </Button>

      <p className="text-center text-sm text-balance text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
