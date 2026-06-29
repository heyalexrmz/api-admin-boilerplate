"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ScrollText } from "lucide-react"

import type { LatencyThresholds, RequestLog } from "@/app/lib/definitions"
import { EmptyState } from "@/components/empty-state"
import { LogDetailsSheet } from "@/components/logs/log-details-sheet"
import {
  INITIAL_LOG_FILTERS,
  type LogFilters,
  LogsFilters,
  parseLogFilters,
} from "@/components/logs/logs-filters"
import { LogsTable } from "@/components/logs/logs-table"
import { useQueryParams } from "@/lib/use-query-params"

function statusMatches(status: number, filter: LogFilters["status"]): boolean {
  if (filter === "all") return true
  if (filter === "success") return status >= 200 && status < 300
  if (filter === "client") return status >= 400 && status < 500
  if (filter === "server") return status >= 500 && status < 600
  return true
}

export function LogsView({
  initialLogs,
  latencyThresholds,
}: {
  initialLogs: RequestLog[]
  latencyThresholds: LatencyThresholds
}) {
  const [selected, setSelected] = useState<RequestLog | null>(null)
  const { searchParams, setQueryParams } = useQueryParams()
  const filters = useMemo(
    () => parseLogFilters(new URLSearchParams(searchParams)),
    [searchParams]
  )

  const keyNameOptions = useMemo(
    () =>
      Array.from(new Set(initialLogs.map((log) => log.keyName))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [initialLogs]
  )

  const filteredLogs = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return initialLogs.filter((log) => {
      if (filters.method !== "all" && log.method !== filters.method) {
        return false
      }
      if (!statusMatches(log.status, filters.status)) {
        return false
      }
      if (filters.keyName !== "all" && log.keyName !== filters.keyName) {
        return false
      }
      if (filters.from || filters.to) {
        const logDay = format(new Date(log.timestamp), "yyyy-MM-dd")
        if (filters.from && logDay < filters.from) return false
        if (filters.to && logDay > filters.to) return false
      }
      if (query) {
        const haystack = `${log.path} ${log.requestId} ${log.keyName}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [filters, initialLogs])

  function updateFilters(next: LogFilters) {
    setQueryParams({
      q: next.query === INITIAL_LOG_FILTERS.query ? null : next.query,
      method: next.method === INITIAL_LOG_FILTERS.method ? null : next.method,
      status: next.status === INITIAL_LOG_FILTERS.status ? null : next.status,
      key: next.keyName === INITIAL_LOG_FILTERS.keyName ? null : next.keyName,
      from: next.from === INITIAL_LOG_FILTERS.from ? null : next.from,
      to: next.to === INITIAL_LOG_FILTERS.to ? null : next.to,
    })
  }

  if (initialLogs.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No request logs"
        description="Incoming API requests will be logged here with method, status, latency, and headers so you can debug and audit traffic."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <LogsFilters
        value={filters}
        onChange={updateFilters}
        keyNameOptions={keyNameOptions}
        resultCount={filteredLogs.length}
        totalCount={initialLogs.length}
      />
      <LogsTable
        logs={filteredLogs}
        latencyThresholds={latencyThresholds}
        onSelect={setSelected}
      />
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
