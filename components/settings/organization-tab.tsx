"use client"

import type {
  OrganizationDetails,
  TeamInvitation,
  TeamMember,
} from "@/app/lib/definitions"
import { OrganizationDetailsCard } from "@/components/settings/organization-details-card"
import { TeamCard } from "@/components/settings/team-card"

export function OrganizationTab({
  organization,
  members,
  invitations,
  canManage,
}: {
  organization: OrganizationDetails
  members: TeamMember[]
  invitations: TeamInvitation[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <OrganizationDetailsCard
        organization={organization}
        canManage={canManage}
      />
      <TeamCard
        initialMembers={members}
        initialInvitations={invitations}
        canManage={canManage}
      />
    </div>
  )
}
