export type Granularity = "hour" | "day" | "week"

export type GranularityOption = {
  value: Granularity
  /** Short toggle label. */
  label: string
  /** Human-readable window label, used as the chart description. */
  range: string
}

export const GRANULARITY_OPTIONS: GranularityOption[] = [
  { value: "hour", label: "24h", range: "Last 24 hours" },
  { value: "day", label: "14d", range: "Last 14 days" },
  { value: "week", label: "12w", range: "Last 12 weeks" },
]

export function parseGranularity(value: string | undefined): Granularity {
  return GRANULARITY_OPTIONS.some((option) => option.value === value)
    ? (value as Granularity)
    : "hour"
}

export type OverviewStats = {
  requests24h: number
  errorCount24h: number
  errorRate24h: number
  avgLatencyMs24h: number
}

export type RequestVolumePoint = { date: string; requests: number }
export type StatusMixPoint = { status: string; count: number; fill: string }
export type LatencyPoint = { date: string; p50: number; p95: number }
