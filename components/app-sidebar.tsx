"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  FileText,
  FolderKanban,
  KeyRound,
  Settings,
  Webhook,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navMain = [
  {
    title: "Resumen",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Tickets",
    url: "/dashboard/tickets",
    icon: FolderKanban,
  },
  {
    title: "API",
    url: "/dashboard/api-overview",
    icon: KeyRound,
    managerOnly: true,
    children: [
      { title: "Resumen API", url: "/dashboard/api-overview", icon: BarChart3 },
      { title: "Llaves API", url: "/dashboard/keys", icon: KeyRound },
      { title: "Registros", url: "/dashboard/logs", icon: FileText },
      { title: "Webhooks", url: "/dashboard/webhooks", icon: Webhook },
      { title: "Documentación", url: "/dashboard/documentation", icon: BookOpen },
    ],
  },
  {
    title: "Superadmin",
    url: "/dashboard/superadmin",
    icon: BarChart3,
    superadminOnly: true,
  },
  {
    title: "Configuración",
    url: "/dashboard/settings",
    icon: Settings,
  },
]

export function AppSidebar({
  user,
  organization,
  organizations,
  canManage,
  isSuperadmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string }
  organization: { id: string; name: string; slug: string; color: string }
  organizations: { id: string; name: string; slug: string; color: string }[]
  canManage: boolean
  isSuperadmin: boolean
}) {
  const pathname = usePathname()
  const items = navMain.filter((item) => {
    if (item.superadminOnly && !isSuperadmin) return false
    if (item.managerOnly && !canManage) return false
    return true
  })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher
          organizations={organizations}
          activeOrganization={organization}
          canCreateOrganization={isSuperadmin}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : item.children
                      ? item.children.some((child) => pathname.startsWith(child.url))
                      : pathname.startsWith(item.url)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.children && (
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const childActive = pathname.startsWith(child.url)
                          return (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton asChild isActive={childActive}>
                                <Link href={child.url}>
                                  <child.icon />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
