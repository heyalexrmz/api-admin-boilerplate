import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitation, member, organization, session, user } from "@/lib/db/schema";
import type { InvitationDetails } from "@/app/lib/definitions";

export type OrganizationRole = "owner" | "admin" | "member";

export const getSession = cache(async () => {
  return await auth.api.getSession({ headers: await headers() });
});

export const getUser = cache(async () => {
  const session = await getSession();
  return session?.user ?? null;
});

export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
});

export const getUserOrganizations = cache(async () => {
  const session = await getSession();
  if (!session) return [];
  const rows = await db.query.member.findMany({
    where: eq(member.userId, session.user.id),
    with: { organization: true },
  });
  return rows.map((r) => r.organization);
});

export const getActiveOrganization = cache(async () => {
  const session = await getSession();
  const orgs = await getUserOrganizations();
  if (orgs.length === 0) return null;

  const activeId = session?.session.activeOrganizationId;
  if (activeId) {
    const active = orgs.find((o) => o.id === activeId);
    if (active) return active;
  }
  return orgs[0] ?? null;
});

export const getActiveMembership = cache(async () => {
  const currentSession = await getSession();
  const org = await getActiveOrganization();
  if (!currentSession || !org) return null;

  const [row] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, currentSession.user.id),
        eq(member.organizationId, org.id)
      )
    )
    .limit(1);

  return row ?? null;
});

export const requireActiveOrganization = cache(async () => {
  const user = await requireUser();
  const org = await getActiveOrganization();
  if (!org) redirect("/onboarding");
  return { user, organization: org };
});

export const getCanManageActiveOrg = cache(async (): Promise<boolean> => {
  const membership = await getActiveMembership();
  return membership?.role === "owner" || membership?.role === "admin";
});

export const requireActiveOrganizationRole = cache(
  async (roles: OrganizationRole[]) => {
    const { user, organization } = await requireActiveOrganization();
    const membership = await getActiveMembership();
    if (!membership || !roles.includes(membership.role as OrganizationRole)) {
      throw new Error("You do not have permission to perform this action.");
    }
    return { user, organization, membership };
  }
);

export async function requireOrganizationManager() {
  return requireActiveOrganizationRole(["owner", "admin"]);
}

export const getInvitationDetails = cache(
  async (invitationId: string): Promise<InvitationDetails | null> => {
    if (!invitationId) return null;

    const row = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        inviterName: user.name,
        workspaceName: organization.name,
      })
      .from(invitation)
      .innerJoin(organization, eq(invitation.organizationId, organization.id))
      .innerJoin(user, eq(user.id, invitation.inviterId))
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.status, "pending"),
          or(isNull(invitation.expiresAt), gt(invitation.expiresAt, new Date()))
        )
      )
      .limit(1);

    if (!row[0]) return null;
    return {
      id: row[0].id,
      email: row[0].email,
      inviterName: row[0].inviterName,
      workspaceName: row[0].workspaceName,
    };
  }
);

export async function acceptInvitationForCurrentUser(invitationId: string) {
  const currentUser = await requireUser();
  const currentSession = await getSession();
  if (!currentSession) redirect("/");

  const [row] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.status, "pending"),
        or(isNull(invitation.expiresAt), gt(invitation.expiresAt, new Date()))
      )
    )
    .limit(1);

  if (!row || row.email.toLowerCase() !== currentUser.email.toLowerCase()) {
    return { ok: false as const };
  }

  const [existingMember] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, currentUser.id),
        eq(member.organizationId, row.organizationId)
      )
    )
    .limit(1);

  if (!existingMember) {
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: row.organizationId,
      userId: currentUser.id,
      role: row.role,
    });
  }

  await db
    .update(invitation)
    .set({ status: "accepted" })
    .where(eq(invitation.id, row.id));

  await db
    .update(session)
    .set({ activeOrganizationId: row.organizationId, updatedAt: new Date() })
    .where(eq(session.id, currentSession.session.id));

  return { ok: true as const };
}
