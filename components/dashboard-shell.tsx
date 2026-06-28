"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeaderActionsContext } from "@/components/dashboard-header-actions"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

const navItems = [
  { name: "Overview", href: "/dashboard" },
  { name: "API Keys", href: "/dashboard/keys" },
  { name: "Logs", href: "/dashboard/logs" },
  { name: "Settings", href: "/dashboard/settings" },
]

export function DashboardShell({
  children,
  user,
  organization,
}: {
  children: React.ReactNode
  user: { name: string; email: string }
  organization: { id: string; name: string; slug: string }
}) {
  const pathname = usePathname()
  const [headerAction, setHeaderAction] = React.useState<React.ReactNode>(null)
  const currentPage =
    navItems.find((item) =>
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname?.startsWith(item.href)
    )?.name ?? "Dashboard"

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar user={user} organization={organization} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <DashboardHeaderActionsContext value={setHeaderAction}>
          <div className="flex min-h-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {currentPage}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your API-as-a-service platform.
                    </p>
                  </div>
                  {headerAction && (
                    <div className="shrink-0">{headerAction}</div>
                  )}
                </div>
                {children}
              </div>
            </main>
          </div>
        </DashboardHeaderActionsContext>
      </SidebarInset>
    </SidebarProvider>
  )
}
