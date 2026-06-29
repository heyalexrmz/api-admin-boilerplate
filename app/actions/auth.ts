"use server"

import { SsoFormSchema, type SsoState } from "@/app/lib/definitions"

async function simulateNetworkDelay() {
  await new Promise((resolve) => setTimeout(resolve, 900))
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
  return {
    message:
      "SSO is not configured for this workspace yet. Use a magic link or contact your administrator.",
  }
}
