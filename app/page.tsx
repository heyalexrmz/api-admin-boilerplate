import { redirect } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

import { AuthShell } from "@/components/auth-shell"
import { PasswordAuthForm } from "@/components/password-auth-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getUser } from "@/app/lib/auth"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>
}) {
  const user = await getUser()
  if (user) redirect("/dashboard")
  const params = await searchParams
  const callbackURL =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard"

  return (
    <AuthShell
      footer={
        <>
          Al iniciar sesión aceptas nuestros{" "}
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-balance">
            Bienvenido de nuevo
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Ingresa tu correo de trabajo y tu contraseña.
          </p>
        </div>
        {params.reset === "success" && (
          <Alert>
            <CheckCircle2 />
            <AlertDescription>Tu contraseña quedó guardada. Ya puedes iniciar sesión.</AlertDescription>
          </Alert>
        )}
        <PasswordAuthForm
          mode="sign-in"
          callbackURL={callbackURL}
        />
      </div>
    </AuthShell>
  )
}
