import type { Metadata } from "next"

import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { SsoForm } from "@/components/sso-form"

export const metadata: Metadata = {
  title: "SSO empresarial · Taxo Timbre",
  description: "Inicia sesión con el proveedor de identidad de tu organización.",
}

export default function SsoPage() {
  return (
    <AuthShell
      footer={
        <>
          SSO lo administra tu equipo de TI.{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Saber más
          </a>
          .
        </>
      }
    >
      <AuthCard
        title="Inicia sesión con SSO"
        description="Usa tu correo corporativo para continuar con tu proveedor de identidad."
      >
        <SsoForm />
      </AuthCard>
    </AuthShell>
  )
}
