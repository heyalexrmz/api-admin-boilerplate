"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm({ token, next = "/dashboard" }: { token?: string; next?: string }) {
  const passwordId = useId()
  const confirmationId = useId()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : "El enlace no es válido o ya venció.")
  const valid = password.length >= 8 && password === confirmation

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !valid) {
      setError(password !== confirmation ? "Las contraseñas no coinciden." : "Usa una contraseña de al menos 8 caracteres.")
      return
    }
    setError(null)
    setLoading(true)
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token })
    setLoading(false)
    if (resetError) {
      setError("No pudimos cambiar la contraseña. Solicita un enlace nuevo.")
      return
    }
    setComplete(true)
  }

  const loginHref = `/?reset=success&next=${encodeURIComponent(next)}`
  if (complete) {
    return (
      <div className="flex flex-col gap-5">
        <Alert><CheckCircle2 /><AlertDescription>Tu contraseña quedó guardada. Ya puedes iniciar sesión.</AlertDescription></Alert>
        <Button asChild><Link href={loginHref}>Iniciar sesión</Link></Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Nueva contraseña</Label>
        <Input id={passwordId} type="password" autoComplete="new-password" autoFocus required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || !token} className="h-10" />
        <p className="text-xs text-muted-foreground">Usa al menos 8 caracteres.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={confirmationId}>Confirmar contraseña</Label>
        <Input id={confirmationId} type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={loading || !token} className="h-10" />
      </div>
      <Button type="submit" disabled={!valid || loading || !token} className="h-10">
        {loading ? <><LoaderCircle className="animate-spin" />Guardando…</> : "Guardar contraseña"}
      </Button>
      {!token && <Button asChild variant="outline"><Link href="/forgot-password">Solicitar otro enlace</Link></Button>}
    </form>
  )
}
