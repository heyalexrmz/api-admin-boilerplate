import Link from "next/link"

import { AuthShell } from "@/components/auth-shell"
import { MagicLinkForm } from "@/components/magic-link-form"

export const metadata = {
  title: "Crear cuenta · Taxo Timbre",
  description: "Crea tu espacio de trabajo en Taxo Timbre.",
}

export default function SignupPage() {
  return (
    <AuthShell
      footer={
        <>
          Al crear una cuenta aceptas nuestros{" "}
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
            Inicia tu prueba gratis
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Ingresa tu correo de trabajo y te enviaremos un enlace seguro para crear tu espacio de trabajo.
          </p>
        </div>
        <MagicLinkForm
          submitLabel="Crear cuenta"
          alternateLink={
            <>
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/"
                className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Inicia sesión
              </Link>
            </>
          }
        />
      </div>
    </AuthShell>
  )
}
