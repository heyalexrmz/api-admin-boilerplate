"use client"

import { Bell, CreditCard, ShieldCheck, SunMoon, User } from "lucide-react"

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
import { SecurityTab } from "@/components/settings/security-tab"

export function SettingsView() {
  return (
    <Tabs defaultValue="account" className="gap-6">
      <TabsList className="justify-start">
        <TabsTrigger value="account">
          <User />
          Account
        </TabsTrigger>
        <TabsTrigger value="billing">
          <CreditCard />
          Billing
        </TabsTrigger>
        <TabsTrigger value="security">
          <ShieldCheck />
          Security
        </TabsTrigger>
        <TabsTrigger value="appearance">
          <SunMoon />
          Appearance
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell />
          Notifications
        </TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="mt-0">
        <AccountTab />
      </TabsContent>
      <TabsContent value="billing" className="mt-0">
        <BillingTab />
      </TabsContent>
      <TabsContent value="security" className="mt-0">
        <SecurityTab />
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
