import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUser, getUserOrganizations } from "@/app/lib/auth";

export const metadata = {
  title: "Configura tu espacio · Taxo Timbre",
  description: "Agrega tu nombre y crea tu primer espacio de trabajo.",
};

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const organizations = await getUserOrganizations();
  if (organizations.length > 0) redirect("/dashboard");

  return (
    <AuthShell
      footer={
        <>
          Al crear un espacio aceptas nuestros{" "}
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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-balance">
            Configura tu espacio
          </CardTitle>
          <CardDescription className="text-pretty">
            Dinos tu nombre y ponle nombre a tu primer espacio. Puedes cambiar ambos después.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
