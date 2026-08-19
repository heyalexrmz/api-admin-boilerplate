import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { ResetPasswordForm } from "@/components/reset-password-form"

export const metadata = {
  title: "Nueva contraseña · Taxo Timbre",
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string; error?: string }> }) {
  const { token, next } = await searchParams
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
  return (
    <AuthShell footer="Tu contraseña se guarda de forma segura y nunca se envía por correo.">
      <AuthCard title="Elige una contraseña" description="Crea la contraseña que usarás para entrar a Taxo Timbre.">
        <ResetPasswordForm token={token} next={safeNext} />
      </AuthCard>
    </AuthShell>
  )
}
