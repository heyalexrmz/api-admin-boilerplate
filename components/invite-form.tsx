"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, TriangleAlert, User } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CloudflareTurnstile } from "@/components/cloudflare-turnstile"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "0x4AAAAAADuoNrUfcLUbVYXk"
const TURNSTILE_ENABLED = process.env.NODE_ENV === "production" && !!TURNSTILE_SITE_KEY

type InviteFormProps = {
  invitationId: string
  email: string
  inviterName: string
  workspaceName: string
  authMode: "sign-in" | "sign-up" | "set-password"
}

export function InviteForm({ invitationId, email, inviterName, workspaceName, authMode }: InviteFormProps) {
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const confirmationId = useId()
  const callbackURL = `/invite/accept?invitationId=${encodeURIComponent(invitationId)}`
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recoverySent, setRecoverySent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Completa la verificación de seguridad para continuar.")
      return
    }
    setError(null)
    setLoading(true)
    const fetchOptions = TURNSTILE_ENABLED
      ? { headers: { "x-captcha-response": turnstileToken ?? "" } }
      : undefined

    if (authMode === "set-password") {
      const { error: requestError } = await authClient.requestPasswordReset({
        email,
        redirectTo: `/reset-password?next=${encodeURIComponent(callbackURL)}`,
        fetchOptions,
      })
      setLoading(false)
      if (requestError) {
        setError("No pudimos enviar el correo para configurar tu contraseña. Intenta de nuevo.")
        return
      }
      setRecoverySent(true)
      return
    }

    if (password.length < 8) {
      setLoading(false)
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (authMode === "sign-up" && password !== confirmation) {
      setLoading(false)
      setError("Las contraseñas no coinciden.")
      return
    }

    const result = authMode === "sign-up"
      ? await authClient.signUp.email({ email, name: name.trim(), password, callbackURL, fetchOptions })
      : await authClient.signIn.email({ email, password, callbackURL, fetchOptions })

    if (result.error) {
      setLoading(false)
      setTurnstileToken(null)
      setTurnstileResetKey((key) => key + 1)
      setError(result.error.code === "INVALID_EMAIL_OR_PASSWORD" ? "La contraseña no es correcta." : "No pudimos aceptar la invitación. Intenta de nuevo.")
      return
    }
    window.location.assign(callbackURL)
  }

  if (recoverySent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert><CheckCircle2 /><AlertDescription>Te enviamos un enlace a <strong className="font-medium">{email}</strong> para elegir tu contraseña. Después podrás aceptar la invitación.</AlertDescription></Alert>
        <Button asChild variant="outline"><Link href="/">Volver al inicio de sesión</Link></Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-pretty text-muted-foreground">
        <span className="font-medium text-foreground">{inviterName}</span> te invitó a unirte a <span className="font-medium text-foreground">{workspaceName}</span>.
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Correo de trabajo</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id={emailId} type="email" defaultValue={email} readOnly tabIndex={-1} aria-readonly="true" className="h-10 bg-muted pl-9" />
        </div>
      </div>
      {authMode === "sign-up" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={nameId}>Nombre completo</Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id={nameId} type="text" autoComplete="name" autoFocus required placeholder="María Pérez" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} className="h-10 pl-9" />
          </div>
        </div>
      )}
      {authMode !== "set-password" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>Contraseña</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id={passwordId} type="password" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} autoFocus={authMode === "sign-in"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} className="h-10 pl-9" />
            </div>
          </div>
          {authMode === "sign-up" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={confirmationId}>Confirmar contraseña</Label>
              <Input id={confirmationId} type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={loading} className="h-10" />
            </div>
          )}
        </>
      )}
      {authMode === "set-password" && (
        <Alert><AlertDescription>Tu cuenta usaba el acceso por correo anterior. Te enviaremos un único enlace para que elijas una contraseña.</AlertDescription></Alert>
      )}
      {TURNSTILE_ENABLED && (
        <CloudflareTurnstile
          siteKey={TURNSTILE_SITE_KEY}
          action="password_auth"
          resetSignal={turnstileResetKey}
          onVerify={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setError("No pudimos cargar la verificación de seguridad. Intenta de nuevo.")}
        />
      )}
      <Button type="submit" size="lg" disabled={loading || (authMode === "sign-up" && !name.trim())} className="h-10 w-full transition-transform active:scale-[0.96]">
        {loading ? <><LoaderCircle className="animate-spin" />Procesando…</> : <>{authMode === "set-password" ? "Configurar contraseña" : "Aceptar invitación"}<ArrowRight /></>}
      </Button>
      <p className="text-center text-sm text-balance text-muted-foreground">
        {authMode === "sign-in" ? (
          <Link href={`/forgot-password?next=${encodeURIComponent(callbackURL)}`} className="font-medium text-foreground underline-offset-4 hover:underline">Olvidé mi contraseña</Link>
        ) : (
          <>¿Ya tienes cuenta? <Link href={`/?next=${encodeURIComponent(callbackURL)}`} className="font-medium text-foreground underline-offset-4 hover:underline">Inicia sesión</Link></>
        )}
      </p>
    </form>
  )
}
