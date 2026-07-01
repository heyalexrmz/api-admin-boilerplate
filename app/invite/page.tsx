import type { Metadata } from "next"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { getInvitationDetails } from "@/app/lib/auth"
import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { InviteForm } from "@/components/invite-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Aceptar invitación · Taxo Timbre",
  description: "Únete a tu equipo en Taxo Timbre.",
}

type PageProps = {
  searchParams: Promise<{
    invitationId?: string
  }>
}

export default async function InvitePage({ searchParams }: PageProps) {
  const params = await searchParams
  const invitation = await getInvitationDetails(params.invitationId ?? "")

  return (
    <AuthShell
      footer={
        <>
          Al aceptar, estás de acuerdo con nuestros{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Términos
          </a>{" "}
          y nuestra{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Política de privacidad
          </a>
          .
        </>
      }
    >
      {invitation ? (
        <AuthCard
          title="Únete a tu equipo"
          description="Configura tu cuenta para acceder al espacio compartido."
        >
          <InviteForm
            invitationId={invitation.id}
            email={invitation.email}
            inviterName={invitation.inviterName}
            workspaceName={invitation.workspaceName}
          />
        </AuthCard>
      ) : (
        <AuthCard
          title="Invitación no disponible"
          description="Este enlace de invitación ya no es válido."
        >
          <div className="flex flex-col gap-5">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                La invitación pudo haber expirado, sido revocada o ya usada. Pide
                a un administrador que te envíe una nueva invitación.
              </AlertDescription>
            </Alert>
            <Button asChild className="h-10">
              <Link href="/">Volver al inicio de sesión</Link>
            </Button>
          </div>
        </AuthCard>
      )}
    </AuthShell>
  )
}
