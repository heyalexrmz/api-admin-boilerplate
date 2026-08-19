"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { CheckCircle2, LoaderCircle, Mail, TriangleAlert } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CloudflareTurnstile } from "@/components/cloudflare-turnstile"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "0x4AAAAAADuoNrUfcLUbVYXk"
const TURNSTILE_ENABLED = process.env.NODE_ENV === "production" && !!TURNSTILE_SITE_KEY

export function ForgotPasswordForm({ next = "/dashboard" }: { next?: string }) {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Completa la verificación de seguridad para continuar.")
      return
    }

    setError(null)
    setLoading(true)
    const { error: requestError } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `/reset-password?next=${encodeURIComponent(next)}`,
      ...(TURNSTILE_ENABLED
        ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken ?? "" } } }
        : {}),
    })
    setLoading(false)

    if (requestError) {
      setError("No pudimos enviar el correo de recuperación. Intenta de nuevo.")
      setTurnstileToken(null)
      setTurnstileResetKey((key) => key + 1)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <CheckCircle2 />
          <AlertDescription>
            Si existe una cuenta para <strong className="font-medium">{email}</strong>, recibirás un enlace para elegir tu contraseña.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline"><Link href="/">Volver al inicio de sesión</Link></Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Correo de trabajo</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id={emailId} type="email" autoComplete="email" autoFocus required placeholder="tu@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} className="h-10 pl-9" />
        </div>
      </div>
      {TURNSTILE_ENABLED && (
        <CloudflareTurnstile siteKey={TURNSTILE_SITE_KEY} action="password_auth" resetSignal={turnstileResetKey} onVerify={(token) => setTurnstileToken(token)} onExpire={() => setTurnstileToken(null)} onError={() => setError("No pudimos cargar la verificación de seguridad. Intenta de nuevo.")} />
      )}
      <Button type="submit" disabled={!EMAIL_RE.test(email.trim()) || loading || (TURNSTILE_ENABLED && !turnstileToken)} className="h-10">
        {loading ? <><LoaderCircle className="animate-spin" />Enviando…</> : "Enviar enlace de recuperación"}
      </Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">Volver al inicio de sesión</Link></p>
    </form>
  )
}
