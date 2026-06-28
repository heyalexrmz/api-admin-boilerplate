import { AuthShell } from "@/components/auth-shell"
import { MagicLinkForm } from "@/components/magic-link-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-balance">
            Start your free trial
          </CardTitle>
          <CardDescription className="text-pretty">
            Enter your work email and we&apos;ll send a secure link to create your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MagicLinkForm
            submitLabel="Create account"
            alternateLink={
              <>
                Already have an account?{" "}
                <a
                  href="/"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
                >
                  Sign in
                </a>
              </>
            }
          />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
