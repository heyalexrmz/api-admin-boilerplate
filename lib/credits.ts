import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { ApiError } from "./api-contracts";
import { db } from "./db";
import {
  creditAccount,
  creditLedgerReason,
  creditLedgerEntry,
  plan,
} from "./db/schema";

export type RefillFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type CreditLedgerReason = (typeof creditLedgerReason.enumValues)[number];

export const CREDIT_COSTS = {
  ticketSubmission: 1,
} as const;

type DbClient = typeof db;

type CreditAccountRow = {
  organizationId: string;
  planId: string;
  planName: string;
  allowance: number;
  refillFrequency: RefillFrequency;
  balance: number;
  lastRefillAt: Date | null;
  nextRefillAt: Date;
};

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function withClampedUtcDate(input: Date, year: number, month: number): Date {
  const day = Math.min(input.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      input.getUTCHours(),
      input.getUTCMinutes(),
      input.getUTCSeconds(),
      input.getUTCMilliseconds()
    )
  );
}

export function computeNextRefillAt(from: Date, frequency: RefillFrequency): Date {
  if (frequency === "daily") {
    const next = new Date(from);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (frequency === "weekly") {
    const next = new Date(from);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "monthly") {
    const year = from.getUTCFullYear();
    const month = from.getUTCMonth() + 1;
    return withClampedUtcDate(from, year + Math.floor(month / 12), month % 12);
  }

  return withClampedUtcDate(from, from.getUTCFullYear() + 1, from.getUTCMonth());
}

export function resetBalanceDelta(input: {
  currentBalance: number;
  allowance: number;
}): number {
  return input.allowance - input.currentBalance;
}

async function selectCreditAccount(
  organizationId: string,
  client: DbClient = db
): Promise<CreditAccountRow | null> {
  const [row] = await client
    .select({
      organizationId: creditAccount.organizationId,
      planId: creditAccount.planId,
      planName: plan.name,
      allowance: plan.ticketCreditAllowance,
      refillFrequency: plan.refillFrequency,
      balance: creditAccount.balance,
      lastRefillAt: creditAccount.lastRefillAt,
      nextRefillAt: creditAccount.nextRefillAt,
    })
    .from(creditAccount)
    .innerJoin(plan, eq(plan.id, creditAccount.planId))
    .where(eq(creditAccount.organizationId, organizationId))
    .limit(1);

  return row ?? null;
}

async function defaultPlan(client: DbClient = db) {
  const [defaultRow] = await client
    .select()
    .from(plan)
    .where(eq(plan.isDefault, true))
    .orderBy(desc(plan.createdAt))
    .limit(1);

  if (defaultRow) return defaultRow;

  const [created] = await client
    .insert(plan)
    .values({
      name: "Starter",
      ticketCreditAllowance: 100,
      refillFrequency: "monthly",
      isDefault: true,
    })
    .returning();

  if (!created) throw new Error("Could not create default credit plan.");
  return created;
}

async function ensureCreditAccount(
  organizationId: string,
  client: DbClient = db,
  now = new Date()
): Promise<CreditAccountRow> {
  const existing = await selectCreditAccount(organizationId, client);
  if (existing) return existing;

  const selectedPlan = await defaultPlan(client);
  const nextRefillAt = computeNextRefillAt(
    now,
    selectedPlan.refillFrequency as RefillFrequency
  );

  await client
    .insert(creditAccount)
    .values({
      organizationId,
      planId: selectedPlan.id,
      balance: selectedPlan.ticketCreditAllowance,
      lastRefillAt: now,
      nextRefillAt,
    })
    .onConflictDoNothing();

  const account = await selectCreditAccount(organizationId, client);
  if (!account) throw new Error("Could not create credit account.");

  await client
    .insert(creditLedgerEntry)
    .values({
      organizationId,
      accountOrganizationId: organizationId,
      planId: account.planId,
      delta: account.balance,
      balanceAfter: account.balance,
      reason: "initial_grant",
      metadata: { source: "account_bootstrap" },
    })
    .onConflictDoNothing();

  return account;
}

export async function ensureAccountRefilled(
  organizationId: string,
  input: { now?: Date; client?: DbClient } = {}
): Promise<CreditAccountRow> {
  const now = input.now ?? new Date();
  const client = input.client ?? db;
  const account = await ensureCreditAccount(organizationId, client, now);

  if (account.nextRefillAt > now) return account;

  const delta = resetBalanceDelta({
    currentBalance: account.balance,
    allowance: account.allowance,
  });
  const nextRefillAt = computeNextRefillAt(now, account.refillFrequency);

  const [updated] = await client
    .update(creditAccount)
    .set({
      balance: account.allowance,
      lastRefillAt: now,
      nextRefillAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(creditAccount.organizationId, organizationId),
        lte(creditAccount.nextRefillAt, now)
      )
    )
    .returning();

  if (!updated) {
    const refreshed = await selectCreditAccount(organizationId, client);
    if (!refreshed) throw new Error("Could not load credit account.");
    return refreshed;
  }

  await client.insert(creditLedgerEntry).values({
    organizationId,
    accountOrganizationId: organizationId,
    planId: account.planId,
    delta,
    balanceAfter: account.allowance,
    reason: "refill",
    metadata: {
      previousBalance: account.balance,
      allowance: account.allowance,
    },
  });

  return {
    ...account,
    balance: account.allowance,
    lastRefillAt: now,
    nextRefillAt,
  };
}

export async function getCreditBalance(organizationId: string) {
  const account = await ensureAccountRefilled(organizationId);
  return {
    object: "credit_balance",
    plan: {
      id: account.planId,
      name: account.planName,
      ticket_credit_allowance: account.allowance,
      refill_frequency: account.refillFrequency,
    },
    credits: {
      balance: account.balance,
      next_refill_at: account.nextRefillAt.toISOString(),
      last_refill_at: account.lastRefillAt?.toISOString() ?? null,
    },
  };
}

export async function debitTicketCredit(input: {
  organizationId: string;
  ticketId: string;
  requestId: string;
  now?: Date;
}) {
  return db.transaction(async (tx) => {
    const now = input.now ?? new Date();
    const account = await ensureAccountRefilled(input.organizationId, {
      now,
      client: tx as unknown as DbClient,
    });
    const cost = CREDIT_COSTS.ticketSubmission;

    const [updated] = await tx
      .update(creditAccount)
      .set({
        balance: sql`${creditAccount.balance} - ${cost}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditAccount.organizationId, input.organizationId),
          gte(creditAccount.balance, cost)
        )
      )
      .returning({
        balance: creditAccount.balance,
      });

    if (!updated) {
      throw new ApiError({
        status: 402,
        code: "insufficient_credits",
        type: "rate_limit_error",
        message: "Your organization does not have enough ticket credits.",
      });
    }

    await tx.insert(creditLedgerEntry).values({
      organizationId: input.organizationId,
      accountOrganizationId: input.organizationId,
      planId: account.planId,
      delta: -cost,
      balanceAfter: updated.balance,
      reason: "ticket_submission",
      ticketId: input.ticketId,
      requestId: input.requestId,
      metadata: { cost },
    });

    return {
      balance: updated.balance,
      debited: cost,
    };
  });
}

export async function adjustCredits(input: {
  organizationId: string;
  delta: number;
  reason?: string;
}) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error("Credit adjustment must be a non-zero integer.");
  }

  return db.transaction(async (tx) => {
    const account = await ensureAccountRefilled(input.organizationId, {
      client: tx as unknown as DbClient,
    });
    const [updated] = await tx
      .update(creditAccount)
      .set({
        balance: sql`${creditAccount.balance} + ${input.delta}`,
        updatedAt: new Date(),
      })
      .where(eq(creditAccount.organizationId, input.organizationId))
      .returning({ balance: creditAccount.balance });

    if (!updated) throw new Error("Could not adjust credits.");

    await tx.insert(creditLedgerEntry).values({
      organizationId: input.organizationId,
      accountOrganizationId: input.organizationId,
      planId: account.planId,
      delta: input.delta,
      balanceAfter: updated.balance,
      reason: "manual_adjustment",
      metadata: { reason: input.reason ?? null },
    });

    return updated.balance;
  });
}

export async function assignPlan(input: {
  organizationId: string;
  planId: string;
  resetBalance?: boolean;
}) {
  const [selectedPlan] = await db
    .select()
    .from(plan)
    .where(eq(plan.id, input.planId))
    .limit(1);
  if (!selectedPlan) throw new Error("Plan not found.");

  return db.transaction(async (tx) => {
    const now = new Date();
    const account = await ensureCreditAccount(
      input.organizationId,
      tx as unknown as DbClient,
      now
    );
    const resetDelta = resetBalanceDelta({
      currentBalance: account.balance,
      allowance: selectedPlan.ticketCreditAllowance,
    });
    const balance = input.resetBalance
      ? selectedPlan.ticketCreditAllowance
      : sql`${creditAccount.balance}`;
    const [updated] = await tx
      .update(creditAccount)
      .set({
        planId: selectedPlan.id,
        balance,
        lastRefillAt: input.resetBalance ? now : undefined,
        nextRefillAt: computeNextRefillAt(
          now,
          selectedPlan.refillFrequency as RefillFrequency
        ),
        updatedAt: now,
      })
      .where(eq(creditAccount.organizationId, input.organizationId))
      .returning();

    if (!updated) throw new Error("Could not assign plan.");

    if (input.resetBalance) {
      await tx.insert(creditLedgerEntry).values({
        organizationId: input.organizationId,
        accountOrganizationId: input.organizationId,
        planId: selectedPlan.id,
        delta: resetDelta,
        balanceAfter: selectedPlan.ticketCreditAllowance,
        reason: "manual_adjustment",
        metadata: { reason: "plan_assignment_reset" },
      });
    }

    return updated;
  });
}
