import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

export async function mcpWorkspace(userId: string, activeOrganizationId: unknown) {
  const memberships = await db
    .select({ organizationId: organization.id, name: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt), asc(member.id));

  return memberships.find(({ organizationId }) => organizationId === activeOrganizationId) ??
    memberships[0] ?? null;
}
