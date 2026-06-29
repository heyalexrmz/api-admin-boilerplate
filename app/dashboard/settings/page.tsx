import { listSessions } from "@/app/actions/sessions"
import {
  getOrganizationDetails,
  listTeamInvitations,
  listTeamMembers,
} from "@/app/actions/organization"
import { getCanManageActiveOrg, requireUser } from "@/app/lib/auth"
import { parseSettingsTab } from "@/app/lib/settings"
import { SettingsView } from "@/components/settings/settings-view"

export const metadata = {
  title: "Settings · Dashboard",
  description: "Manage your account, organization, billing, security, and preferences.",
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const user = await requireUser()
  const sessions = await listSessions()

  const [organization, members, invitations, canManage] = await Promise.all([
    getOrganizationDetails(),
    listTeamMembers(),
    listTeamInvitations(),
    getCanManageActiveOrg(),
  ])

  return (
    <SettingsView
      user={{
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        email: user.email,
        timezone: user.timezone ?? null,
        bio: user.bio ?? null,
      }}
      sessions={sessions}
      organization={
        organization ?? {
          id: "",
          name: "",
          slug: "",
          logo: null,
        }
      }
      members={members}
      invitations={invitations}
      canManage={canManage}
      initialTab={parseSettingsTab(params.tab)}
    />
  )
}
