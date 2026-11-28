import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { PasswordAuthForm } from "@/components/password-auth-form";

export const metadata: Metadata = { title: "Conectar con Taxo Timbre", referrer: "no-referrer" };

export default function OAuthLoginPage() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Conectar con Taxo Timbre</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión para continuar con la autorización.</p>
        </div>
        <PasswordAuthForm mode="sign-in" oauth />
      </div>
    </AuthShell>
  );
}
