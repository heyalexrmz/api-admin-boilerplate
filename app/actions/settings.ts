"use server"

import { redirect } from "next/navigation"

import {
  ProfileFormSchema,
  type SettingsFormState,
} from "@/app/lib/definitions"

async function simulateNetworkDelay() {
  await new Promise((resolve) => setTimeout(resolve, 900))
}

// Every settings action must verify the session — Server Functions are
// reachable via direct POST, not just through the UI.
async function requireAuth() {
  await simulateNetworkDelay()
  // const session = await auth()
  // if (!session?.user) throw new Error("Unauthorized")
  // return session
}

export async function updateProfile(
  prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAuth()

  const validated = ProfileFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    timezone: formData.get("timezone"),
    bio: formData.get("bio"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // await store.updateUser(session.user.id, validated.data)
  return { success: true }
}

export async function deleteAccount(
  prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAuth()

  const confirmed = String(formData.get("confirm") ?? "")
  // In production this comes from the session, never from the client.
  const sessionEmail = "jane@company.com"

  if (confirmed.trim().toLowerCase() !== sessionEmail.toLowerCase()) {
    return { message: "Type your email exactly to confirm deletion." }
  }

  // await store.deleteUser(session.user.id)
  redirect("/")
}
