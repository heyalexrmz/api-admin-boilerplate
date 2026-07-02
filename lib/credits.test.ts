import { describe, expect, it } from "vitest";

import {
  CREDIT_COSTS,
  PLAN_TIERS,
  computeNextRefillAt,
  resetBalanceDelta,
} from "./credits";

describe("computeNextRefillAt", () => {
  it("computes the next daily refill from the current time", () => {
    expect(
      computeNextRefillAt(new Date("2026-06-29T06:30:00.000Z"), "daily").toISOString()
    ).toBe("2026-06-30T06:30:00.000Z");
  });

  it("computes the next weekly refill from the current time", () => {
    expect(
      computeNextRefillAt(new Date("2026-06-29T06:30:00.000Z"), "weekly").toISOString()
    ).toBe("2026-07-06T06:30:00.000Z");
  });

  it("computes the next monthly refill from the current time", () => {
    expect(
      computeNextRefillAt(new Date("2026-01-31T06:30:00.000Z"), "monthly").toISOString()
    ).toBe("2026-02-28T06:30:00.000Z");
  });

  it("computes the next yearly refill from the current time", () => {
    expect(
      computeNextRefillAt(new Date("2024-02-29T06:30:00.000Z"), "yearly").toISOString()
    ).toBe("2025-02-28T06:30:00.000Z");
  });
});

describe("resetBalanceDelta", () => {
  it("returns the ledger delta needed to reset a balance to the plan allowance", () => {
    expect(resetBalanceDelta({ currentBalance: 3, allowance: 10 })).toBe(7);
    expect(resetBalanceDelta({ currentBalance: 12, allowance: 10 })).toBe(-2);
  });
});

describe("CREDIT_COSTS", () => {
  it("charges one credit for a live ticket submission", () => {
    expect(CREDIT_COSTS.ticketSubmission).toBe(1);
  });
});

describe("PLAN_TIERS", () => {
  it("defines Base, Pro, Partner, and Custom ticket allowances", () => {
    expect(PLAN_TIERS).toEqual([
      { name: "Base", ticketCreditAllowance: 20, isDefault: true },
      { name: "Pro", ticketCreditAllowance: 50, isDefault: false },
      { name: "Partner", ticketCreditAllowance: 100, isDefault: false },
      { name: "Custom", ticketCreditAllowance: 0, isDefault: false },
    ]);
  });
});
