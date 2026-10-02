import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "@/components/status-badge"
import { TicketRequestOverview } from "./ticket-request-overview"

describe("ticket outcome overview", () => {
  it("shows a separate non-invoiceable total without lowering technical success", () => {
    const html = renderToStaticMarkup(<TicketRequestOverview overview={{
      total: 50, finalized: 8, failed: 2, notInvoiceable: 30, active: 10,
      last24h: 0, live: 50, sandbox: 0, recentTickets: [],
    }} />)
    expect(html).toContain("No facturables")
    expect(html).toContain("Tasa de éxito")
    expect(html).toContain("80.0%")
    expect(html).toContain("excluye no facturables")
  })

  it("does not claim a success rate when only non-invoiceable tickets exist", () => {
    const html = renderToStaticMarkup(<TicketRequestOverview overview={{
      total: 30, finalized: 0, failed: 0, notInvoiceable: 30, active: 0,
      last24h: 0, live: 30, sandbox: 0, recentTickets: [],
    }} />)
    expect(html).toContain("—")
    expect(html).not.toContain("NaN")
    expect(html).not.toContain("100.0%")
  })

  it("labels the new status in Spanish", () => {
    expect(renderToStaticMarkup(<StatusBadge status="not_invoiceable" />)).toContain("No facturable")
  })
})
