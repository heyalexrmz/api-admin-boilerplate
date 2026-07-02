import { getBillingOverview } from "@/app/actions/billing"
import { listSessions } from "@/app/actions/sessions"
import {
  getOrganizationDetails,
  listTeamInvitations,
  listTeamMembers,
} from "@/app/actions/organization"
import { getDashboardCapabilities, requireUser } from "@/app/lib/auth"
import { parseSettingsTab } from "@/app/lib/settings"
import { SettingsView } from "@/components/settings/settings-view"
import { ORG_COLORS } from "@/lib/org-branding"

export const metadata = {
  title: "Configuración · Taxo Timbre",
  description: "Administra tu cuenta, organización, facturación, seguridad y preferencias.",
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const user = await requireUser()
  const sessions = await listSessions()

  const [organization, members, invitations, capabilities] = await Promise.all([
    getOrganizationDetails(),
    listTeamMembers(),
    listTeamInvitations(),
    getDashboardCapabilities(),
  ])
  const canManage = capabilities.canManage
  const billing = canManage ? await getBillingOverview() : null

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
          color: ORG_COLORS[0],
        }
      }
      members={members}
      invitations={invitations}
      billing={billing}
      canManage={canManage}
      initialTab={parseSettingsTab(params.tab)}
    />
  )
}
