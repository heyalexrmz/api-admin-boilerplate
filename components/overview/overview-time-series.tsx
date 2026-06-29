"use client"

import {
  GRANULARITY_OPTIONS,
  type Granularity,
  type LatencyPoint,
  type RequestVolumePoint,
  type StatusMixPoint,
} from "@/app/lib/overview"
import { LatencyChart } from "@/components/overview/latency-chart"
import { RequestVolumeChart } from "@/components/overview/request-volume-chart"
import { StatusMixChart } from "@/components/overview/status-mix-chart"
import { cn } from "@/lib/utils"
import { useQueryParams } from "@/lib/use-query-params"

export function OverviewTimeSeries({
  initialTimeSeries,
  initialStatusMix,
  initialGranularity = "hour",
}: {
  initialTimeSeries: { volume: RequestVolumePoint[]; latency: LatencyPoint[] }
  initialStatusMix: StatusMixPoint[]
  initialGranularity?: Granularity
}) {
  const { setQueryParams } = useQueryParams()

  function selectGranularity(next: Granularity) {
    setQueryParams({ granularity: next === "hour" ? null : next })
  }

  const range =
    GRANULARITY_OPTIONS.find((o) => o.value === initialGranularity)?.range ??
    "Last 24 hours"

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Time granularity"
          className="flex items-center gap-1 rounded-lg border p-0.5"
        >
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectGranularity(opt.value)}
              aria-pressed={initialGranularity === opt.value}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                initialGranularity === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestVolumeChart data={initialTimeSeries.volume} range={range} />
        </div>
        <div className="lg:col-span-1">
          <StatusMixChart data={initialStatusMix} />
        </div>
      </div>

      <LatencyChart data={initialTimeSeries.latency} range={range} />
    </div>
  )
}
