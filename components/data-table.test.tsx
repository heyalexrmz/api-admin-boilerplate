// @vitest-environment jsdom

import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "./data-table"

type Item = { id: string; status: string }
const rows: Item[] = Array.from({ length: 35 }, (_, index) => ({
  id: `ticket-${String(index + 1).padStart(2, "0")}`, status: "pending",
}))
const columns: ColumnDef<Item>[] = [
  { accessorKey: "id", header: ({ column }) => <button onClick={column.getToggleSortingHandler()}>Ticket</button> },
  { accessorKey: "status", header: "Estado" },
]
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(data: Item[], props: Partial<React.ComponentProps<typeof DataTable<Item, unknown>>> = {}) {
  await act(async () => root.render(
    <DataTable columns={columns} data={data} caption="Tickets" paginationResetKey="all" getRowId={(row) => row.id} {...props} />
  ))
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === label || element.getAttribute("aria-label") === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  await act(async () => button.click())
}

describe("DataTable pagination", () => {
  it("keeps the current page when polling replaces the rows with updated records", async () => {
    await render(rows)
    await click("Siguiente")
    expect(container.textContent).toContain("Página 2 de 4")
    await render(rows.map((row) => ({ ...row, status: "finalized" })))
    expect(container.textContent).toContain("Página 2 de 4")
    expect(container.querySelector("tbody")?.textContent).toContain("ticket-11")
    expect(container.querySelector("tbody")?.textContent).toContain("finalized")
  })

  it("returns to the first page when filters change, even if the row count stays the same", async () => {
    await render(rows)
    await click("Siguiente")
    await render(rows, { paginationResetKey: "failed" })
    expect(container.textContent).toContain("Página 1 de 4")
  })

  it("clamps to the last available page when live results shrink", async () => {
    await render(rows)
    await click("Última página")
    expect(container.textContent).toContain("Página 4 de 4")
    await render(rows.slice(0, 15))
    expect(container.textContent).toContain("Página 2 de 2")
    expect(container.textContent).toContain("11–15")
    expect(container.querySelector("tbody")?.textContent).toContain("ticket-11")
    await render(rows)
    expect(container.textContent).toContain("Página 2 de 4")
  })

  it("recovers from an empty result set without restoring a stale page", async () => {
    await render(rows)
    await click("Última página")
    await render([])
    expect(container.textContent).toContain("No results.")
    expect(container.textContent).not.toContain("Mostrando")
    await render(rows)
    expect(container.textContent).toContain("Página 1 de 4")
  })

  it("starts a new sort at page one and exposes the sort direction", async () => {
    await render(rows)
    await click("Siguiente")
    await click("Ticket")
    expect(container.textContent).toContain("Página 1 de 4")
    expect(container.querySelector("th")?.getAttribute("aria-sort")).toBe("ascending")
  })

  it("keeps keyboard focus on the same ticket when another record is inserted", async () => {
    await render(rows, { onRowClick: vi.fn() })
    const row = container.querySelector("tbody tr") as HTMLElement
    row.focus()
    await render([{ id: "new-ticket", status: "pending" }, ...rows], { onRowClick: vi.fn() })
    expect(document.activeElement).toBe(row)
    expect(document.activeElement?.textContent).toContain("ticket-01")
  })

  it("does not intercept keyboard activation of a button inside a clickable row", async () => {
    const onRowClick = vi.fn()
    const actionColumns: ColumnDef<Item>[] = [{ id: "action", cell: () => <button>Retry</button> }]
    await render(rows, { columns: actionColumns, onRowClick })
    const button = container.querySelector("tbody button")!
    await act(async () => button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(onRowClick).not.toHaveBeenCalled()
    await act(async () => container.querySelector("tbody tr")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it("retains the existing automatic reset for tables that do not opt into refresh preservation", async () => {
    await render(rows, { paginationResetKey: undefined })
    await click("Siguiente")
    await render([...rows], { paginationResetKey: undefined })
    expect(container.textContent).toContain("Página 1 de 4")
  })
})
