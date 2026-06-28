import type { Metadata } from "next"

import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { SsoForm } from "@/components/sso-form"

export const metadata: Metadata = {
  title: "Enterprise SSO · Acme",
  description: "Sign in with your organization's identity provider.",
}

export default function SsoPage() {
  return (
    <AuthShell
      footer={
        <>
          SSO is managed by your IT admin.{" "}
          <a
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Learn more
          </a>
          .
        </>
      }
    >
      <AuthCard
        title="Sign in with SSO"
        description="Use your company email to continue to your identity provider."
      >
        <SsoForm />
      </AuthCard>
    </AuthShell>
  )
}
