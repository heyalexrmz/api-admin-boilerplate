"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getSession } from "@/app/lib/auth"
import {
  ProfileFormSchema,
  type SettingsFormState,
} from "@/app/lib/definitions"

export async function updateProfile(
  prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await getSession()
  if (!session) {
    throw new Error("No autorizado")
  }

  const validated = ProfileFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { firstName, lastName } = validated.data
  const name = `${firstName} ${lastName}`.trim()

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { name, firstName, lastName },
    })
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No pudimos actualizar tu perfil.",
    }
  }

  return { success: true, firstName, lastName }
}

export async function deleteAccount(
  prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await getSession()
  if (!session) {
    throw new Error("No autorizado")
  }

  const confirmed = String(formData.get("confirm") ?? "")
  if (
    confirmed.trim().toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return { message: "Escribe tu correo exactamente para confirmar la eliminación." }
  }

  try {
    await auth.api.deleteUser({ headers: await headers(), body: {} })
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No pudimos eliminar tu cuenta.",
    }
  }

  redirect("/")
}
