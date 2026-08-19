import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export const metadata = {
  title: "Recuperar contraseña · Taxo Timbre",
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
  return (
    <AuthShell footer="Por seguridad, el enlace de recuperación vence en una hora.">
      <AuthCard title="Recupera tu contraseña" description="Te enviaremos un enlace para elegir una contraseña nueva.">
        <ForgotPasswordForm next={safeNext} />
      </AuthCard>
    </AuthShell>
  )
}
