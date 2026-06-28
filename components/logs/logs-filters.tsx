"use client"

import { Search, X } from "lucide-react"

import { HTTP_METHODS, type HttpMethod } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type LogStatusFilter = "all" | "success" | "client" | "server"

export type LogFilters = {
  query: string
  method: HttpMethod | "all"
  status: LogStatusFilter
  keyName: string | "all"
}

export const INITIAL_LOG_FILTERS: LogFilters = {
  query: "",
  method: "all",
  status: "all",
  keyName: "all",
}

const STATUS_OPTIONS: { value: LogStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success · 2xx" },
  { value: "client", label: "Client error · 4xx" },
  { value: "server", label: "Server error · 5xx" },
]

type LogsFiltersProps = {
  value: LogFilters
  onChange: (next: LogFilters) => void
  keyNameOptions: string[]
  resultCount: number
  totalCount: number
}

export function LogsFilters({
  value,
  onChange,
  keyNameOptions,
  resultCount,
  totalCount,
}: LogsFiltersProps) {
  const isFiltered =
    value.query !== "" ||
    value.method !== "all" ||
    value.status !== "all" ||
    value.keyName !== "all"

  function update(patch: Partial<LogFilters>) {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={value.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Search path, request ID, or key…"
            aria-label="Search logs"
            className="h-9 pl-9"
          />
        </div>

        <Select
          value={value.method}
          onValueChange={(next) => update({ method: next as HttpMethod | "all" })}
        >
          <SelectTrigger size="sm" className="h-9 w-32" aria-label="Filter by method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {HTTP_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.status}
          onValueChange={(next) => update({ status: next as LogStatusFilter })}
        >
          <SelectTrigger size="sm" className="h-9 w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.keyName}
          onValueChange={(next) => update({ keyName: next })}
        >
          <SelectTrigger
            size="sm"
            className="h-9 w-44 max-w-full"
            aria-label="Filter by API key"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All API keys</SelectItem>
            {keyNameOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => onChange(INITIAL_LOG_FILTERS)}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        Showing <span className="font-medium text-foreground">{resultCount}</span>{" "}
        of {totalCount} requests
      </p>
    </div>
  )
}
