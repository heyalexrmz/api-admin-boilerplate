"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getSession } from "@/app/lib/auth";
import { slugify } from "@/lib/slugify";
import { OnboardingFormSchema } from "@/app/lib/definitions";

export type OnboardingState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  success?: boolean;
} | undefined;

export async function createOrganization(
  prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const validated = OnboardingFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    name: formData.get("name"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { firstName, lastName, name } = validated.data;
  const slug = slugify(name);
  if (!slug) {
    return { errors: { name: ["Choose a name with letters or numbers."] } };
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const requestHeaders = await headers();

  try {
    await auth.api.updateUser({
      headers: requestHeaders,
      body: { name: fullName, firstName, lastName },
    });
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Could not save your profile. Try again.",
    };
  }

  try {
    await auth.api.createOrganization({
      headers: requestHeaders,
      body: { name, slug },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your workspace.";
    if (/slug|exists|taken|unique/i.test(message)) {
      return { errors: { name: ["That workspace name is taken. Try another."] } };
    }
    return { message };
  }

  redirect("/dashboard");
}
