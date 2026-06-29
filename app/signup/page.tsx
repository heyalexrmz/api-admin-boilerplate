import Link from "next/link"

import { AuthShell } from "@/components/auth-shell"
import { MagicLinkForm } from "@/components/magic-link-form"

export const metadata = {
  title: "Sign up · Acme",
  description: "Create your Acme workspace.",
}

export default function SignupPage() {
  return (
    <AuthShell
      footer={
        <>
          By creating an account you agree to our{" "}
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
            Start your free trial
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Enter your work email and we&apos;ll send a secure link to create your workspace.
          </p>
        </div>
        <MagicLinkForm
          submitLabel="Create account"
          alternateLink={
            <>
              Already have an account?{" "}
              <Link
                href="/"
                className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Sign in
              </Link>
            </>
          }
        />
      </div>
    </AuthShell>
  )
}
