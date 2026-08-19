"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, TriangleAlert } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CloudflareTurnstile } from "@/components/cloudflare-turnstile"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ??
  "0x4AAAAAADuoNrUfcLUbVYXk"
const TURNSTILE_ENABLED =
  process.env.NODE_ENV === "production" && !!TURNSTILE_SITE_KEY

function friendlyAuthError(code?: string) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "El correo o la contraseña no son correctos."
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con este correo. Inicia sesión o restablece tu contraseña."
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres."
    case "PASSWORD_TOO_LONG":
      return "La contraseña es demasiado larga."
    default:
      return "No pudimos completar el acceso. Intenta de nuevo."
  }
}

export function PasswordAuthForm({
  mode,
  callbackURL = "/dashboard",
  alternateLink,
}: {
  mode: "sign-in" | "sign-up"
  callbackURL?: string
  alternateLink?: React.ReactNode
}) {
  const emailId = useId()
  const passwordId = useId()
  const confirmationId = useId()
  const isSignUp = mode === "sign-up"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const valid =
    EMAIL_RE.test(email.trim()) &&
    password.length >= 8 &&
    (!isSignUp || password === confirmation)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) {
      setError(
        isSignUp && password !== confirmation
          ? "Las contraseñas no coinciden."
          : "Revisa el correo y usa una contraseña de al menos 8 caracteres."
      )
      return
    }
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Completa la verificación de seguridad para continuar.")
      return
    }

    setError(null)
    setLoading(true)
    const fetchOptions = TURNSTILE_ENABLED
      ? { headers: { "x-captcha-response": turnstileToken ?? "" } }
      : undefined

    const result = isSignUp
      ? await authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.trim().split("@")[0],
          callbackURL,
          fetchOptions,
        })
      : await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL,
          fetchOptions,
        })

    if (result.error) {
      setLoading(false)
      setError(friendlyAuthError(result.error.code))
      setTurnstileToken(null)
      setTurnstileResetKey((key) => key + 1)
      return
    }

    window.location.assign(callbackURL)
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
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={passwordId}>Contraseña</Label>
          {!isSignUp && (
            <Link href={`/forgot-password?next=${encodeURIComponent(callbackURL)}`} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Olvidé mi contraseña
            </Link>
          )}
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            className="h-10 px-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {isSignUp && <p className="text-xs text-muted-foreground">Usa al menos 8 caracteres.</p>}
      </div>

      {isSignUp && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={confirmationId}>Confirmar contraseña</Label>
          <Input
            id={confirmationId}
            name="passwordConfirmation"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={loading}
            className="h-10"
          />
        </div>
      )}

      {TURNSTILE_ENABLED && (
        <CloudflareTurnstile
          siteKey={TURNSTILE_SITE_KEY}
          action="password_auth"
          resetSignal={turnstileResetKey}
          onVerify={(token) => {
            setError(null)
            setTurnstileToken(token)
          }}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setError("No pudimos cargar la verificación de seguridad. Intenta de nuevo.")}
        />
      )}

      <Button type="submit" size="lg" disabled={!valid || loading || (TURNSTILE_ENABLED && !turnstileToken)} className="h-10 w-full transition-transform active:scale-[0.96]">
        {loading ? (
          <><LoaderCircle className="animate-spin" />Procesando…</>
        ) : (
          <>{isSignUp ? "Crear cuenta" : "Iniciar sesión"}<ArrowRight /></>
        )}
      </Button>

      {alternateLink && <p className="text-center text-sm text-balance text-muted-foreground">{alternateLink}</p>}
    </form>
  )
}
