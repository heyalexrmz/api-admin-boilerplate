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
  title: "Accept invite · Acme",
  description: "Join your team on Acme.",
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
          By accepting you agree to our{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Privacy Policy
          </a>
          .
        </>
      }
    >
      {invitation ? (
        <AuthCard
          title="Join your team"
          description="Set up your account to access the shared workspace."
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
          title="Invitation unavailable"
          description="This invitation link is no longer valid."
        >
          <div className="flex flex-col gap-5">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                The invitation may have expired, been revoked, or already been used. Ask
                your workspace admin to send you a new invite.
              </AlertDescription>
            </Alert>
            <Button asChild className="h-10">
              <Link href="/">Back to sign in</Link>
            </Button>
          </div>
        </AuthCard>
      )}
    </AuthShell>
  )
}
