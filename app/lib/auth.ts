import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

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
  const orgs = await getUserOrganizations();
  return orgs[0] ?? null;
});

export const requireActiveOrganization = cache(async () => {
  const user = await requireUser();
  const org = await getActiveOrganization();
  if (!org) redirect("/onboarding");
  return { user, organization: org };
});
