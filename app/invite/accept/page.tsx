import { notFound, redirect } from "next/navigation"

import { acceptInvitationForCurrentUser } from "@/app/lib/auth"

type PageProps = {
  searchParams: Promise<{
    invitationId?: string
  }>
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const { invitationId } = await searchParams
  if (!invitationId) notFound()

  const result = await acceptInvitationForCurrentUser(invitationId)
  if (!result.ok) notFound()

  redirect("/dashboard")
}
