// @vitest-environment jsdom

import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ router: { refresh: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@/app/actions/facturador", () => ({ getDashboardTicketDetail: vi.fn(), retryDashboardTicket: vi.fn() }))
vi.mock("./ticket-detail-sheet", () => ({ TicketDetailSheet: () => null }))

import type { DashboardTicket } from "@/app/lib/definitions"
import { TicketsView } from "./tickets-view"

const tickets: DashboardTicket[] = Array.from({ length: 35 }, (_, index) => ({
  id: `ticket-${String(index + 1).padStart(2, "0")}`,
  taxId: index < 25 ? "EXAMPLE-A" : "EXAMPLE-B",
  status: "pending", livemode: true, canRetry: false,
  originalFileName: "ticket.jpg", errorCode: null, errorType: null, errorMessage: null,
  invoiceId: null, invoiceUuid: null, documentCount: 1,
  createdAt: "2026-10-02T12:00:00Z", updatedAt: "2026-10-02T12:00:00Z", finalizedAt: null,
}))
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  mocks.router.refresh.mockReset()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function render(rows = tickets) {
  root.render(<TicketsView initialTickets={rows} canManage={false} />)
}

async function nextPage() {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!
  await act(async () => button.click())
}

describe("tickets table refresh and filtering", () => {
  it("preserves the current page across the actual polling callback", async () => {
    await act(async () => render())
    await nextPage()
    mocks.router.refresh.mockImplementation(() => render(tickets.map((ticket) => ({ ...ticket, updatedAt: "2026-10-02T12:00:05Z" }))))
    await act(async () => vi.advanceTimersByTime(5000))
    expect(mocks.router.refresh).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Página 2 de 4")
    expect(container.querySelector("tbody")?.textContent).toContain("ticket-11")
  })

  it("resets the page for a search and preserves it on the next refresh", async () => {
    await act(async () => render())
    await nextPage()
    const search = container.querySelector<HTMLInputElement>('input[aria-label="Buscar tickets"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "EXAMPLE-A")
      search.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(container.textContent).toContain("Página 1 de 3")
    await nextPage()
    await act(async () => render(tickets.map((ticket) => ({ ...ticket }))))
    expect(container.textContent).toContain("Página 2 de 3")
    expect(search.value).toBe("EXAMPLE-A")
  })

  it("offers manual refresh even when no tickets are active and retains the page", async () => {
    const finished = tickets.map((ticket) => ({ ...ticket, status: "finalized" }))
    await act(async () => render(finished))
    await nextPage()
    mocks.router.refresh.mockImplementation(() => render(finished.map((ticket) => ({ ...ticket }))))
    const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Actualizar")!
    await act(async () => button.click())
    expect(mocks.router.refresh).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Página 2 de 4")
    await act(async () => vi.advanceTimersByTime(5000))
    expect(mocks.router.refresh).toHaveBeenCalledOnce()
  })
})
