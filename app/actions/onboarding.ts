"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getSession } from "@/app/lib/auth";
import { slugify } from "@/lib/slugify";

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

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { errors: { name: ["Use at least 2 characters."] } };
  }

  const slug = slugify(name);
  if (!slug) {
    return { errors: { name: ["Choose a name with letters or numbers."] } };
  }

  try {
    await auth.api.createOrganization({
      headers: await headers(),
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
