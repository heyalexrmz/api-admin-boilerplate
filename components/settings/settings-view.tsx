"use client"

import { Bell, CreditCard, ShieldCheck, SunMoon, User, Users } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { AccountTab } from "@/components/settings/account-tab"
import { AppearanceTab } from "@/components/settings/appearance-tab"
import { BillingTab } from "@/components/settings/billing-tab"
import { NotificationsTab } from "@/components/settings/notifications-tab"
import { OrganizationTab } from "@/components/settings/organization-tab"
import { SecurityTab } from "@/components/settings/security-tab"
import type { BillingOverview } from "@/app/actions/billing"
import type {
  OrganizationDetails,
  SessionView,
  SettingsUser,
  TeamInvitation,
  TeamMember,
} from "@/app/lib/definitions"
import type { SettingsTab } from "@/app/lib/settings"
import { useQueryParams } from "@/lib/use-query-params"

export function SettingsView({
  user,
  sessions,
  organization,
  members,
  invitations,
  billing,
  canManage,
  initialTab,
}: {
  user: SettingsUser
  sessions: SessionView[]
  organization: OrganizationDetails
  members: TeamMember[]
  invitations: TeamInvitation[]
  billing: BillingOverview | null
  canManage: boolean
  initialTab: SettingsTab
}) {
  const { setQueryParams } = useQueryParams()

  function selectTab(tab: string) {
    setQueryParams({ tab: tab === "account" ? null : tab })
  }

  return (
    <Tabs value={initialTab} onValueChange={selectTab} className="gap-6">
      <TabsList className="justify-start">
        <TabsTrigger value="account">
          <User />
          Cuenta
        </TabsTrigger>
        <TabsTrigger value="organization">
          <Users />
          Organización
        </TabsTrigger>
        <TabsTrigger value="billing">
          <CreditCard />
          Facturación
        </TabsTrigger>
        <TabsTrigger value="security">
          <ShieldCheck />
          Seguridad
        </TabsTrigger>
        <TabsTrigger value="appearance">
          <SunMoon />
          Apariencia
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell />
          Notificaciones
        </TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="mt-0">
        <AccountTab user={user} />
      </TabsContent>
      <TabsContent value="organization" className="mt-0">
        <OrganizationTab
          organization={organization}
          members={members}
          invitations={invitations}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="billing" className="mt-0">
        <BillingTab billing={billing} canManage={canManage} />
      </TabsContent>
      <TabsContent value="security" className="mt-0">
        <SecurityTab initialSessions={sessions} />
      </TabsContent>
      <TabsContent value="appearance" className="mt-0">
        <AppearanceTab />
      </TabsContent>
      <TabsContent value="notifications" className="mt-0">
        <NotificationsTab />
      </TabsContent>
    </Tabs>
  )
}
