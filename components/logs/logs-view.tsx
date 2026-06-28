"use client"

import { useMemo, useState } from "react"

import type { RequestLog } from "@/app/lib/definitions"
import { LogDetailsSheet } from "@/components/logs/log-details-sheet"
import {
  INITIAL_LOG_FILTERS,
  type LogFilters,
  LogsFilters,
} from "@/components/logs/logs-filters"
import { LogsTable } from "@/components/logs/logs-table"
import { MOCK_LOGS } from "@/components/logs/mock-logs"

function statusMatches(status: number, filter: LogFilters["status"]): boolean {
  if (filter === "all") return true
  if (filter === "success") return status >= 200 && status < 300
  if (filter === "client") return status >= 400 && status < 500
  if (filter === "server") return status >= 500 && status < 600
  return true
}

export function LogsView() {
  const [selected, setSelected] = useState<RequestLog | null>(null)
  const [filters, setFilters] = useState<LogFilters>(INITIAL_LOG_FILTERS)

  const keyNameOptions = useMemo(
    () =>
      Array.from(new Set(MOCK_LOGS.map((log) => log.keyName))).sort((a, b) =>
        a.localeCompare(b)
      ),
    []
  )

  const filteredLogs = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return MOCK_LOGS.filter((log) => {
      if (filters.method !== "all" && log.method !== filters.method) {
        return false
      }
      if (!statusMatches(log.status, filters.status)) {
        return false
      }
      if (filters.keyName !== "all" && log.keyName !== filters.keyName) {
        return false
      }
      if (query) {
        const haystack = `${log.path} ${log.requestId} ${log.keyName}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [filters])

  return (
    <div className="flex flex-col gap-4">
      <LogsFilters
        value={filters}
        onChange={setFilters}
        keyNameOptions={keyNameOptions}
        resultCount={filteredLogs.length}
        totalCount={MOCK_LOGS.length}
      />
      <LogsTable logs={filteredLogs} onSelect={setSelected} />
      <LogDetailsSheet
        log={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}
