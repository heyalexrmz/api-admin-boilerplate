"use server"

import { revalidatePath } from "next/cache"
import { desc } from "drizzle-orm"

import {
  requireActiveOrganization,
  requireOrganizationManager,
  requireSuperadmin,
} from "@/app/lib/auth"
import { db } from "@/lib/db"
import { organization, plan } from "@/lib/db/schema"
import {
  adjustCredits,
  assignPlan,
  getCreditBalance,
  type RefillFrequency,
} from "@/lib/credits"

export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>
export type BillingPlanOption = Awaited<ReturnType<typeof listBillingPlans>>[number]
export type SuperadminBillingOrganization = Awaited<
  ReturnType<typeof listSuperadminBillingOrganizations>
>[number]

export async function getBillingOverview() {
  const { organization } = await requireOrganizationManager()
  return getCreditBalance(organization.id)
}

export async function listBillingPlans() {
  await requireSuperadmin()
  const rows = await db.select().from(plan).orderBy(desc(plan.isDefault), plan.name)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ticketCreditAllowance: row.ticketCreditAllowance,
    refillFrequency: row.refillFrequency as RefillFrequency,
    isDefault: row.isDefault,
  }))
}

export async function listSuperadminBillingOrganizations() {
  await requireSuperadmin()
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .orderBy(organization.name)

  return Promise.all(
    rows.map(async (row) => {
      const balance = await getCreditBalance(row.id)
      return {
        ...row,
        plan: balance.plan,
        credits: balance.credits,
      }
    })
  )
}

export async function assignOrganizationPlan(formData: FormData) {
  await requireSuperadmin()
  const organizationId = String(formData.get("organizationId") ?? "")
  const planId = String(formData.get("planId") ?? "")
  const resetBalance = formData.get("resetBalance") === "on"

  if (!organizationId || !planId) {
    throw new Error("Choose an organization and plan.")
  }

  await assignPlan({ organizationId, planId, resetBalance })
  revalidatePath("/dashboard/superadmin")
}

export async function adjustOrganizationCredits(formData: FormData) {
  await requireSuperadmin()
  const organizationId = String(formData.get("organizationId") ?? "")
  const delta = Number(formData.get("delta"))
  const reason = String(formData.get("reason") ?? "").trim()

  if (!organizationId || !Number.isInteger(delta) || delta === 0) {
    throw new Error("Enter a non-zero whole-number credit adjustment.")
  }

  await adjustCredits({ organizationId, delta, reason: reason || undefined })
  revalidatePath("/dashboard/superadmin")
}

export async function getActiveOrganizationBilling() {
  const { organization } = await requireActiveOrganization()
  return getCreditBalance(organization.id)
}
