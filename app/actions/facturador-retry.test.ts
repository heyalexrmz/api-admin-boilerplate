import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), retry: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/app/lib/auth", () => ({ requireOrganizationManager: mocks.auth, requireActiveOrganization: vi.fn() }));
vi.mock("@/lib/facturador/retry", () => ({ retryTicketSubmission: mocks.retry }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { retryDashboardTicket } from "./facturador";

const ticketId = "ede4dccc-a001-45d2-a6ed-2af7f4b57f02";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ organization: { id: "active-org" }, user: { id: "manager" } });
  mocks.retry.mockResolvedValue({ success: true });
});

describe("dashboard retry authorization", () => {
  it("uses the authenticated organization and actor, then refreshes both dashboard pages", async () => {
    expect(await retryDashboardTicket(ticketId)).toEqual({ success: true });
    expect(mocks.retry).toHaveBeenCalledWith({ ticketId, organizationId: "active-org", userId: "manager" });
    expect(mocks.revalidate.mock.calls).toEqual([["/dashboard/tickets"], ["/dashboard"]]);
  });

  it("does not enqueue when manager authorization fails", async () => {
    mocks.auth.mockRejectedValue(new Error("Permission denied"));
    await expect(retryDashboardTicket(ticketId)).rejects.toThrow("Permission denied");
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs before reaching persistence", async () => {
    expect(await retryDashboardTicket("invalid")).toHaveProperty("error");
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("returns a stale-state rejection without claiming success", async () => {
    mocks.retry.mockResolvedValue({ error: "El intento anterior sigue en curso." });
    expect(await retryDashboardTicket(ticketId)).toEqual({ error: "El intento anterior sigue en curso." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
