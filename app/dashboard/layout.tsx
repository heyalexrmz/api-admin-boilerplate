import { DashboardShell } from "@/components/dashboard-shell"
import {
  getCanManageActiveOrg,
  getUserOrganizations,
  requireActiveOrganization,
} from "@/app/lib/auth"
import { getOrgColor } from "@/lib/org-branding"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, organization } = await requireActiveOrganization()
  const organizations = await getUserOrganizations()
  const canManage = await getCanManageActiveOrg()

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email }}
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        color: getOrgColor(organization),
      }}
      organizations={organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        color: getOrgColor(o),
      }))}
      canManage={canManage}
    >
      {children}
    </DashboardShell>
  )
}
