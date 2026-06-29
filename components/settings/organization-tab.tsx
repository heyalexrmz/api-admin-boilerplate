"use client"

import type {
  LatencyThresholds,
  OrganizationDetails,
  TeamInvitation,
  TeamMember,
} from "@/app/lib/definitions"
import { LatencyThresholdCard } from "@/components/settings/latency-threshold-card"
import { OrganizationDetailsCard } from "@/components/settings/organization-details-card"
import { TeamCard } from "@/components/settings/team-card"

export function OrganizationTab({
  organization,
  members,
  invitations,
  latencyThresholds,
  canManage,
  canEditLatencyThresholds,
}: {
  organization: OrganizationDetails
  members: TeamMember[]
  invitations: TeamInvitation[]
  latencyThresholds: LatencyThresholds
  canManage: boolean
  canEditLatencyThresholds: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <OrganizationDetailsCard
        organization={organization}
        canManage={canManage}
      />
      <LatencyThresholdCard
        thresholds={latencyThresholds}
        canEdit={canEditLatencyThresholds}
      />
      <TeamCard
        initialMembers={members}
        initialInvitations={invitations}
        canManage={canManage}
      />
    </div>
  )
}
