"use client"

import { useId, useState } from "react"
import { ArrowRight, CheckCircle2, LoaderCircle, Mail, TriangleAlert } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function MagicLinkForm({
  submitLabel = "Continuar",
  alternateLink,
}: {
  submitLabel?: string
  alternateLink?: React.ReactNode
}) {
  const emailId = useId()
  const emailErrorId = useId()

  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const emailValid = isValidEmail(email)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isValidEmail(email)) return
    setError(null)
    setLoading(true)
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? "No pudimos enviar el enlace de acceso. Intenta de nuevo.")
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
            Enviamos un enlace de acceso a <strong className="font-medium">{sentTo}</strong>. Haz clic en el enlace del correo para continuar.
          </AlertDescription>
        </Alert>
        <p className="text-center text-sm text-muted-foreground text-pretty">
          ¿No recibiste el correo? Revisa spam o{" "}
          <button
            type="button"
            onClick={() => {
              setSentTo(null)
              setEmail("")
            }}
            className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
          >
            intenta con otro correo
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Correo de trabajo</Label>
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
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? emailErrorId : undefined}
            className="h-10 pl-9"
          />
        </div>
        {error && (
          <p id={emailErrorId} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!emailValid || loading}
        className="h-10 w-full transition-transform active:scale-[0.96]"
      >
        {loading ? (
          <>
            <LoaderCircle className="animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight />
          </>
        )}
      </Button>

      {alternateLink && (
        <p className="text-center text-sm text-balance text-muted-foreground">
          {alternateLink}
        </p>
      )}
    </form>
  )
}
