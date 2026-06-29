import Link from "next/link"

import { AuthShell } from "@/components/auth-shell"
import { MagicLinkForm } from "@/components/magic-link-form"

export default function LoginPage() {
  return (
    <AuthShell
      footer={
        <>
          By signing in you agree to our{" "}
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-balance">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Enter your work email and we&apos;ll send a secure sign-in link.
          </p>
        </div>
        <MagicLinkForm
          alternateLink={
            <>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Start a trial
              </Link>
            </>
          }
        />
      </div>
    </AuthShell>
  )
}
