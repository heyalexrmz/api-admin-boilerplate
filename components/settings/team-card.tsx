"use client"

import { useState } from "react"
import { Users } from "lucide-react"

import type { OrganizationRole, TeamInvitation, TeamMember } from "@/app/lib/definitions"
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog"
import { SettingsSection } from "@/components/settings/settings-section"
import { TeamInvitationsList } from "@/components/settings/team-invitations-list"
import { TeamMembersTable } from "@/components/settings/team-members-table"

export function TeamCard({
  initialMembers,
  initialInvitations,
  canManage,
}: {
  initialMembers: TeamMember[]
  initialInvitations: TeamInvitation[]
  canManage: boolean
}) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [invitations, setInvitations] =
    useState<TeamInvitation[]>(initialInvitations)

  function handleInvited(invitation: TeamInvitation) {
    setInvitations((prev) =>
      prev.some((i) => i.id === invitation.id) ? prev : [invitation, ...prev]
    )
  }

  function handleMemberRemoved(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function handleRoleChanged(id: string, role: OrganizationRole) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role } : m))
    )
  }

  function handleInvitationCanceled(id: string) {
    setInvitations((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Team members"
        description="People with access to this workspace. Change roles or remove access anytime."
        footer={
          canManage ? (
            <InviteMemberDialog
              onInvited={handleInvited}
              canInvite={canManage}
            />
          ) : undefined
        }
      >
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">No members yet</p>
            <p className="max-w-sm text-sm text-pretty text-muted-foreground">
              Invite teammates to collaborate on this workspace.
            </p>
          </div>
        ) : (
          <TeamMembersTable
            members={members}
            canManage={canManage}
            onRemoved={handleMemberRemoved}
            onRoleChanged={handleRoleChanged}
          />
        )}
      </SettingsSection>

      {invitations.length > 0 && (
        <SettingsSection
          title="Pending invitations"
          description="Invites sent to teammates who haven't accepted yet. Cancel to revoke a pending invite."
        >
          <TeamInvitationsList
            invitations={invitations}
            onCanceled={handleInvitationCanceled}
          />
        </SettingsSection>
      )}
    </div>
  )
}
