"use client"

import { useMemo, useState, useTransition } from "react"
import {
  type Column,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from "lucide-react"

import {
  INVITABLE_ROLES,
  OrganizationRoleLabels,
  type OrganizationRole,
  type TeamMember,
} from "@/app/lib/definitions"
import { updateMemberRole } from "@/app/actions/organization"
import { toast } from "@/lib/toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RoleBadge } from "@/components/settings/role-badge"
import { RemoveMemberDialog } from "@/components/settings/remove-member-dialog"
import { formatRelativeTime } from "@/lib/format"

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SortableHeader<TData>({
  column,
  children,
}: {
  column: Column<TData, unknown>
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 text-left font-medium"
    >
      {children}
      <Icon className={sorted ? "size-3.5 opacity-70" : "size-3.5 opacity-40"} />
    </button>
  )
}

function MemberActions({
  member,
  canManage,
  onRemoved,
  onRoleChanged,
}: {
  member: TeamMember
  canManage: boolean
  onRemoved: (id: string) => void
  onRoleChanged: (id: string, role: OrganizationRole) => void
}) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const manageable = canManage && !member.isCurrentUser && member.role !== "owner"

  if (!manageable) {
    return <span className="block text-right text-xs text-muted-foreground">—</span>
  }

  function handleRoleChange(role: OrganizationRole) {
    if (pending) return
    startTransition(async () => {
      const res = await updateMemberRole(member.id, role)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onRoleChanged(member.id, res.role)
      toast.success(`Role updated to ${OrganizationRoleLabels[res.role]}`)
    })
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Actions for ${member.name}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Change role</DropdownMenuLabel>
          {INVITABLE_ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onSelect={() => handleRoleChange(role)}
              disabled={member.role === role}
            >
              <span className="flex-1">{OrganizationRoleLabels[role]}</span>
              {member.role === role && (
                <Badge variant="outline" className="text-[10px]">
                  Current
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setRemoveOpen(true)}
          >
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveMemberDialog
        member={member}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onRemoved={onRemoved}
      />
    </div>
  )
}

export function TeamMembersTable({
  members,
  canManage,
  onRemoved,
  onRoleChanged,
}: {
  members: TeamMember[]
  canManage: boolean
  onRemoved: (id: string) => void
  onRoleChanged: (id: string, role: OrganizationRole) => void
}) {
  const columns = useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        accessorKey: "name",
        size: 240,
        header: ({ column }) => (
          <SortableHeader column={column}>Member</SortableHeader>
        ),
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8" size="default">
                <AvatarFallback className="bg-muted text-xs font-medium">
                  {memberInitials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 truncate font-medium">
                  {m.name}
                  {m.isCurrentUser && (
                    <Badge variant="outline" className="text-[10px]">
                      You
                    </Badge>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {m.email}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "role",
        size: 120,
        header: ({ column }) => (
          <SortableHeader column={column}>Role</SortableHeader>
        ),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "joinedAt",
        size: 140,
        header: ({ column }) => (
          <SortableHeader column={column}>Joined</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 64,
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <MemberActions
            member={row.original}
            canManage={canManage}
            onRemoved={onRemoved}
            onRoleChanged={onRoleChanged}
          />
        ),
      },
    ],
    [canManage, onRemoved, onRoleChanged]
  )

  return (
    <DataTable
      columns={columns}
      data={members}
      caption="Team members"
      empty="No members yet."
      pageSize={10}
    />
  )
}
