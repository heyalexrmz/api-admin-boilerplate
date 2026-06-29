"use client"

import { useState } from "react"
import { CalendarIcon, CalendarRange, X } from "lucide-react"
import { format, subDays } from "date-fns"

import { HTTP_METHODS, type HttpMethod } from "@/app/lib/definitions"
import { FilterBar, FilterSearchInput } from "@/components/filter-bar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type LogStatusFilter = "all" | "success" | "client" | "server"

export type LogFilters = {
  query: string
  method: HttpMethod | "all"
  status: LogStatusFilter
  keyName: string | "all"
  /** Inclusive lower bound as `yyyy-MM-dd`, or null. */
  from: string | null
  /** Inclusive upper bound as `yyyy-MM-dd`, or null. */
  to: string | null
}

export const INITIAL_LOG_FILTERS: LogFilters = {
  query: "",
  method: "all",
  status: "all",
  keyName: "all",
  from: null,
  to: null,
}

const STATUS_OPTIONS: { value: LogStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success · 2xx" },
  { value: "client", label: "Client error · 4xx" },
  { value: "server", label: "Server error · 5xx" },
]

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 15 days", days: 15 },
  { label: "Last 30 days", days: 30 },
] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Parse a `yyyy-MM-dd` string into a Date at local midnight (avoids UTC drift). */
function parseDateValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Validate and normalize a date query param; returns null if invalid. */
function normalizeDateParam(raw: string | null): string | null {
  if (!raw || !DATE_RE.test(raw)) return null
  const date = parseDateValue(raw)
  return Number.isNaN(date.getTime()) ? null : raw
}

/** Compute the `yyyy-MM-dd` range for a preset ending today (inclusive). */
function presetRange(days: number): { from: string; to: string } {
  const to = format(new Date(), "yyyy-MM-dd")
  const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd")
  return { from, to }
}

function isPresetActive(filters: LogFilters, days: number): boolean {
  const { from, to } = presetRange(days)
  return filters.from === from && filters.to === to
}

export function parseLogFilters(searchParams: URLSearchParams): LogFilters {
  const method = searchParams.get("method")
  const status = searchParams.get("status")
  const keyName = searchParams.get("key")?.trim()

  return {
    query: searchParams.get("q") ?? "",
    method: HTTP_METHODS.includes(method as HttpMethod)
      ? (method as HttpMethod)
      : "all",
    status: STATUS_OPTIONS.some((option) => option.value === status)
      ? (status as LogStatusFilter)
      : "all",
    keyName: keyName || "all",
    from: normalizeDateParam(searchParams.get("from")),
    to: normalizeDateParam(searchParams.get("to")),
  }
}

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
    value.keyName !== "all" ||
    value.from !== null ||
    value.to !== null

  function update(patch: Partial<LogFilters>) {
    onChange({ ...value, ...patch })
  }

  const activePreset = DATE_PRESETS.find((preset) =>
    isPresetActive(value, preset.days)
  )

  return (
    <FilterBar
      search={
        <FilterSearchInput
          value={value.query}
          onChange={(q) => update({ query: q })}
          placeholder="Search path, request ID, or key…"
          ariaLabel="Search logs"
        />
      }
      resultCount={resultCount}
      totalCount={totalCount}
      resultLabel="requests"
      isFiltered={isFiltered}
      onClear={() => onChange(INITIAL_LOG_FILTERS)}
    >
      <div className="flex items-center gap-2">
        <Select
          value={value.method}
          onValueChange={(next) => update({ method: next as HttpMethod | "all" })}
        >
          <SelectTrigger className="w-32" aria-label="Filter by method">
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
          <SelectTrigger className="w-44" aria-label="Filter by status">
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
          <SelectTrigger className="w-44 max-w-full" aria-label="Filter by API key">
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
      </div>

      <div
        className="hidden h-5 w-px shrink-0 bg-border md:block"
        aria-hidden="true"
      />

      <div className="flex items-center gap-2">
        <Select
          value={activePreset ? String(activePreset.days) : undefined}
          onValueChange={(id) => {
            const preset = DATE_PRESETS.find((p) => String(p.days) === id)
            if (preset) {
              const range = presetRange(preset.days)
              update({ from: range.from, to: range.to })
            }
          }}
        >
          <SelectTrigger className="w-40" aria-label="Quick date range">
            <CalendarRange className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Quick range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset.days} value={String(preset.days)}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateFilterPicker
          label="From date"
          value={value.from}
          maxDate={value.to ? parseDateValue(value.to) : undefined}
          onSelect={(date) => update({ from: format(date, "yyyy-MM-dd") })}
          onClear={() => update({ from: null })}
        />
        <DateFilterPicker
          label="To date"
          value={value.to}
          minDate={value.from ? parseDateValue(value.from) : undefined}
          onSelect={(date) => update({ to: format(date, "yyyy-MM-dd") })}
          onClear={() => update({ to: null })}
        />
      </div>
    </FilterBar>
  )
}

type DateFilterPickerProps = {
  label: string
  value: string | null
  minDate?: Date
  maxDate?: Date
  onSelect: (date: Date) => void
  onClear: () => void
}

function DateFilterPicker({
  label,
  value,
  minDate,
  maxDate,
  onSelect,
  onClear,
}: DateFilterPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseDateValue(value) : undefined

  const disabled: ({ before: Date } | { after: Date })[] = []
  if (minDate) disabled.push({ before: minDate })
  if (maxDate) disabled.push({ after: maxDate })
  disabled.push({ after: new Date() })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-[168px] justify-start gap-2 px-2.5 text-left font-normal",
            !selected && "text-muted-foreground"
          )}
          aria-label={label}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">
            {selected ? format(selected, "MMM d, yyyy") : label}
          </span>
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label}`}
              className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onClear()
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onClear()
                }
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={disabled}
          onSelect={(date) => {
            if (date) {
              onSelect(date)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
