"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronsUpDown, LoaderCircle, Plus } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { toast } from "@/lib/toast"
import { CreateOrganizationDialog } from "@/components/create-organization-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type Org = {
  id: string
  name: string
  slug: string
}

function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function OrgSwitcher({
  organizations,
  activeOrganization,
}: {
  organizations: Org[]
  activeOrganization: Org | null
}) {
  const { isMobile } = useSidebar()
  const [pending, startSwitch] = React.useTransition()
  const [switching, setSwitching] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)

  if (!activeOrganization) {
    return null
  }

  async function switchOrg(org: Org) {
    startSwitch(async () => {
      const { error } = await authClient.organization.setActive({
        organizationId: org.id,
      })
      if (error) {
        toast.error(error.message ?? "Could not switch workspaces.")
        return
      }
      // Hard reload so every client component remounts with the new org's
      // data. A soft router.refresh() would preserve stale local state
      // (e.g. the API keys table, selected log, sessions list) from the
      // previous workspace — dangerous in a multi-tenant app.
      setSwitching(true)
      window.location.reload()
    })
  }

  const showOverlay = pending || switching

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {orgInitials(activeOrganization.name)}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeOrganization.name}
                </span>
                <span className="truncate text-xs">{activeOrganization.slug}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {organizations.map((org) => {
              const isActive = org.id === activeOrganization.id
              return (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={() => switchOrg(org)}
                  disabled={pending || isActive}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent text-[10px] font-semibold">
                    {orgInitials(org.name)}
                  </div>
                  <span className="flex-1 truncate">{org.name}</span>
                  <Check
                    className={cn(
                      "size-4",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setCreateOpen(true)}
              className="gap-2 p-2"
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                New workspace
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />

      {showOverlay &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Switching workspace…</p>
          </div>,
          document.body
        )}
    </SidebarMenu>
  )
}
