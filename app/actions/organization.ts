"use server"

import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull, or, gt } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { invitation, member, user } from "@/lib/db/schema"
import { sendInvitationEmail } from "@/lib/email/resend"
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch"
import { getOrgColor } from "@/lib/org-branding"
import {
  getActiveMembership,
  requireActiveOrganization,
  requireOrganizationManager,
} from "@/app/lib/auth"
import {
  InviteMemberFormSchema,
  ORGANIZATION_ROLES,
  UpdateOrganizationFormSchema,
  type InviteMemberState,
  type MemberActionResponse,
  type OrganizationDetails,
  type OrganizationRole,
  type TeamInvitation,
  type TeamMember,
  type UpdateMemberRoleResponse,
  type UpdateOrganizationState,
} from "@/app/lib/definitions"

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

type MemberRow = {
  id: string
  userId: string
  role: string
  joinedAt: Date
  name: string
  email: string
}

function toTeamMember(row: MemberRow, currentUserId: string): TeamMember {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role as OrganizationRole,
    joinedAt: row.joinedAt.toISOString(),
    isCurrentUser: row.userId === currentUserId,
  }
}

type InvitationRow = {
  id: string
  email: string
  role: string
  status: string
  createdAt: Date
  expiresAt: Date | null
}

function toTeamInvitation(row: InvitationRow, canCancel: boolean): TeamInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role as OrganizationRole,
    status: row.status as TeamInvitation["status"],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    canCancel,
  }
}

function isManagerRole(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin"
}

export async function getOrganizationDetails(): Promise<OrganizationDetails | null> {
  const { organization } = await requireActiveOrganization()
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo ?? null,
    color: getOrgColor(organization),
  }
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const { user: currentUser, organization } = await requireActiveOrganization()

  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organization.id))
    .orderBy(desc(member.createdAt))

  return rows.map((row) => toTeamMember(row, currentUser.id))
}

export async function listTeamInvitations(): Promise<TeamInvitation[]> {
  const { organization } = await requireActiveOrganization()
  const membership = await getActiveMembership()
  const canCancel = isManagerRole(membership?.role)

  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organization.id),
        eq(invitation.status, "pending"),
        or(isNull(invitation.expiresAt), gt(invitation.expiresAt, new Date()))
      )
    )
    .orderBy(desc(invitation.createdAt))

  return rows.map((row) => toTeamInvitation(row, canCancel))
}

export async function updateOrganizationDetails(
  prevState: UpdateOrganizationState,
  formData: FormData
): Promise<UpdateOrganizationState> {
  await requireOrganizationManager()

  const validated = UpdateOrganizationFormSchema.safeParse({
    name: formData.get("name"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { name } = validated.data

  try {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { data: { name } },
    })
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Could not update the organization.",
    }
  }

  return { success: true, name }
}

export async function inviteMember(
  prevState: InviteMemberState,
  formData: FormData
): Promise<InviteMemberState> {
  const { user: currentUser, organization } = await requireOrganizationManager()

  const validated = InviteMemberFormSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { email, role } = validated.data

  const normalizedEmail = email.toLowerCase()

  if (normalizedEmail === currentUser.email.toLowerCase()) {
    return { errors: { email: ["You can't invite yourself."] } }
  }

  const [existingMember] = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organization.id),
        eq(user.email, normalizedEmail)
      )
    )
    .limit(1)

  if (existingMember) {
    return { errors: { email: ["That person is already a member."] } }
  }

  const [existingInvite] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organization.id),
        eq(invitation.email, normalizedEmail),
        eq(invitation.status, "pending"),
        or(isNull(invitation.expiresAt), gt(invitation.expiresAt, new Date()))
      )
    )
    .limit(1)

  if (existingInvite) {
    return { errors: { email: ["An invite is already pending for that email."] } }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)
  const id = randomUUID()

  await db.insert(invitation).values({
    id,
    organizationId: organization.id,
    email: normalizedEmail,
    role,
    status: "pending",
    expiresAt,
    inviterId: currentUser.id,
    createdAt: now,
  })

  try {
    await sendInvitationEmail({
      to: normalizedEmail,
      inviterName: currentUser.name,
      organizationName: organization.name,
      invitationId: id,
    })
  } catch (error) {
    console.error("[invites] invitation email failed", error)
  }

  dispatchOrganizationWebhookEvent(organization.id, "member.invited", {
    id,
    email: normalizedEmail,
    role,
    organizationId: organization.id,
    inviterId: currentUser.id,
    expiresAt: expiresAt.toISOString(),
  }).catch((error) => {
    console.error("[webhooks] member.invited dispatch failed", error)
  })

  return {
    success: true,
    invitation: toTeamInvitation(
      {
        id,
        email: normalizedEmail,
        role,
        status: "pending",
        createdAt: now,
        expiresAt,
      },
      true
    ),
  }
}

export async function cancelInvitation(
  invitationId: string
): Promise<MemberActionResponse> {
  const { organization } = await requireOrganizationManager()

  if (!invitationId) return { error: "Missing invitation id." }

  const [row] = await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organization.id),
        eq(invitation.status, "pending")
      )
    )
    .returning({ id: invitation.id })

  if (!row) return { error: "Invitation not found or already used." }

  return { success: true }
}

export async function removeMember(
  memberId: string
): Promise<MemberActionResponse> {
  const { user, organization } = await requireOrganizationManager()

  if (!memberId) return { error: "Missing member id." }

  const [target] = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
    })
    .from(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organization.id))
    )
    .limit(1)

  if (!target) return { error: "Member not found." }
  if (target.userId === user.id) {
    return { error: "You can't remove yourself. Transfer ownership first." }
  }
  if (target.role === "owner") {
    return { error: "The owner can't be removed." }
  }

  await db
    .delete(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organization.id))
    )

  dispatchOrganizationWebhookEvent(organization.id, "member.removed", {
    memberId: target.id,
    userId: target.userId,
    organizationId: organization.id,
  }).catch((error) => {
    console.error("[webhooks] member.removed dispatch failed", error)
  })

  return { success: true }
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<UpdateMemberRoleResponse> {
  const { user, organization } = await requireOrganizationManager()

  if (!memberId) return { error: "Missing member id." }
  if (!ORGANIZATION_ROLES.includes(role as OrganizationRole)) {
    return { error: "Invalid role." }
  }
  const nextRole = role as OrganizationRole

  const [target] = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
    })
    .from(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organization.id))
    )
    .limit(1)

  if (!target) return { error: "Member not found." }
  if (target.role === "owner") {
    return { error: "The owner's role can't be changed." }
  }
  if (target.userId === user.id) {
    return { error: "You can't change your own role." }
  }
  if (nextRole === "owner") {
    return { error: "Ownership transfers aren't supported here." }
  }

  await db
    .update(member)
    .set({ role: nextRole })
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organization.id))
    )

  return { success: true, role: nextRole }
}
