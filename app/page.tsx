import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth-shell"
import { MagicLinkForm } from "@/components/magic-link-form"
import { getUser } from "@/app/lib/auth"

export default async function LoginPage() {
  const user = await getUser()
  if (user) redirect("/dashboard")

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
            Ingresa tu correo de trabajo y te enviaremos un enlace seguro de acceso.
          </p>
        </div>
        <MagicLinkForm
          alternateLink={
            <>
              ¿No tienes cuenta?{" "}
              <Link
                href="/signup"
                className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Inicia una prueba
              </Link>
            </>
          }
        />
      </div>
    </AuthShell>
  )
}
