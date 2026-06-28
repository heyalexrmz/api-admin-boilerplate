import Link from "next/link"
import type { Metadata } from "next"
import { Clock3 } from "lucide-react"

import { AuthCard } from "@/components/auth-card"
import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Session expired · Acme",
  description: "Your session has expired. Sign in again to continue.",
}

export default function SessionExpiredPage() {
  return (
    <AuthShell
      footer={
        <>
          Sessions expire after 12 hours of inactivity for security.
        </>
      }
    >
      <AuthCard
        title="Session expired"
        description="For your security, we signed you out after a period of inactivity."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 px-4 py-6 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock3 className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-pretty text-muted-foreground">
              Sign in again to pick up where you left off. Unsaved changes may
              have been lost.
            </p>
          </div>

          <Button asChild size="lg" className="h-10 w-full">
            <Link href="/">Sign in again</Link>
          </Button>

          <Button asChild variant="outline" className="h-10 w-full">
            <Link href="/sso">Continue with SSO</Link>
          </Button>
        </div>
      </AuthCard>
    </AuthShell>
  )
}
