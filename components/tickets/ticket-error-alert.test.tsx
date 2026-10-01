import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TicketErrorAlert } from "./ticket-error-alert"

describe("TicketErrorAlert", () => {
  it("shows the failure and reason without promising another attempt", () => {
    const html = renderToStaticMarkup(<TicketErrorAlert ticket={{
      status: "failed", errorCode: "UPSTREAM_RATE_LIMITED", errorType: "quota", errorMessage: "Rate limited",
    }} />)
    expect(html).toContain("No se pudo facturar el ticket")
    expect(html).toContain("límite temporal")
    expect(html).toContain("no se reenviará automáticamente")
    expect(html).not.toContain("Próximo intento")
  })

  it("corrects the historical quota classification", () => {
    const html = renderToStaticMarkup(<TicketErrorAlert ticket={{
      status: "failed", errorCode: "UPSTREAM_VALIDATION", errorType: "validation",
      errorMessage: "Request was throttled. Expected available in 35115 seconds.",
    }} />)
    expect(html).toContain("UPSTREAM_RATE_LIMITED")
    expect(html).not.toContain("UPSTREAM_VALIDATION")
  })

  it("does not disclose service identity in a stored error", () => {
    const html = renderToStaticMarkup(<TicketErrorAlert ticket={{
      status: "failed", errorCode: "TOCINO_ERROR", errorType: "site",
      errorMessage: "Tocino: dato inválido; revisa https://api.tocino.example/error",
    }} />)
    expect(html.toLowerCase()).not.toContain("tocino")
    expect(html).toContain("dato inválido")
  })
})
