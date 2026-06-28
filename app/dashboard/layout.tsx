import { DashboardShell } from "@/components/dashboard-shell"
import { requireActiveOrganization } from "@/app/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, organization } = await requireActiveOrganization()

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email }}
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      }}
    >
      {children}
    </DashboardShell>
  )
}
