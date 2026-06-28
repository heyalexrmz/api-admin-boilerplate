import type { Metadata } from "next"

import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { InviteForm } from "@/components/invite-form"

export const metadata: Metadata = {
  title: "Accept invite · Acme",
  description: "Join your team on Acme.",
}

type PageProps = {
  searchParams: Promise<{
    email?: string
    inviter?: string
    workspace?: string
  }>
}

export default async function InvitePage({ searchParams }: PageProps) {
  const params = await searchParams

  const email = params.email ?? "alex@northwind.com"
  const inviterName = params.inviter ?? "Maya Rodriguez"
  const workspaceName = params.workspace ?? "Northwind Ops"

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
      <AuthCard
        title="Join your team"
        description="Set up your account to access the shared workspace."
      >
        <InviteForm
          email={email}
          inviterName={inviterName}
          workspaceName={workspaceName}
        />
      </AuthCard>
    </AuthShell>
  )
}
