import { DashboardShell } from "@/components/dashboard-shell"
import {
  getCanManageActiveOrg,
  getUserOrganizations,
  requireActiveOrganization,
} from "@/app/lib/auth"

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
      }}
      organizations={organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
      }))}
      canManage={canManage}
    >
      {children}
    </DashboardShell>
  )
}
