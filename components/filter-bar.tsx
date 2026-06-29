"use client"

import type { ReactNode } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Search input used as the primary control in a {@link FilterBar}.
 * Sized to match the `Input` base height (`h-8`) with a leading search icon.
 */
export function FilterSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}) {
  return (
    <div className={cn("relative min-w-48 max-w-sm flex-1", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9"
      />
    </div>
  )
}

/**
 * Shared two-row filter layout used across list views.
 *
 * Row 1: the search input (left, capped width) and the result count (right).
 * Row 2: grouped filter controls passed as children, plus a Clear button that
 * shows only when a filter is active. Every control uses its default size so
 * the row stays at the `Input` `h-8` baseline.
 */
export function FilterBar({
  search,
  resultCount,
  totalCount,
  resultLabel = "requests",
  isFiltered,
  onClear,
  children,
}: {
  search: ReactNode
  resultCount: number
  totalCount: number
  resultLabel?: string
  isFiltered: boolean
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {search}
        <p className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
          Showing <span className="font-medium text-foreground">{resultCount}</span>{" "}
          of {totalCount} {resultLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {children}
        {isFiltered && (
          <Button type="button" variant="ghost" onClick={onClear}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
