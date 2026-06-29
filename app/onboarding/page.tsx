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
  title: "Set up your workspace · Acme",
  description: "Add your name and create your first Acme workspace.",
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
          By creating a workspace you agree to our{" "}
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
            Set up your workspace
          </CardTitle>
          <CardDescription className="text-pretty">
            Tell us your name and name your first workspace. You can change both later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
