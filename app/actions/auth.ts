"use server"

import { redirect } from "next/navigation"

import {
  InviteFormSchema,
  SsoFormSchema,
  type InviteState,
  type SsoState,
} from "@/app/lib/definitions"

async function simulateNetworkDelay() {
  await new Promise((resolve) => setTimeout(resolve, 900))
}

export async function acceptInvite(
  prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const validated = InviteFormSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await simulateNetworkDelay()
  redirect("/dashboard")
}

export async function ssoLogin(
  prevState: SsoState,
  formData: FormData
): Promise<SsoState> {
  const validated = SsoFormSchema.safeParse({
    email: formData.get("email"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await simulateNetworkDelay()
  redirect("/dashboard")
}

export async function resendInviteEmail(): Promise<void> {
  await simulateNetworkDelay()
}
