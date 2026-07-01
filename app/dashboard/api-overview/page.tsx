import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { countActiveApiKeys } from "@/app/actions/api-keys"
import {
  getOverviewStats,
  getStatusMix24h,
  getTimeSeries,
} from "@/app/actions/overview"
import { parseGranularity } from "@/app/lib/overview"
import { OverviewTimeSeries } from "@/components/overview/overview-time-series"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Resumen API · Taxo Timbre",
  description: "Resumen de telemetría de la API",
}

export const dynamic = "force-dynamic"

function StatCard({
  label,
  value,
  trend,
  trendLabel,
  good = true,
  note,
}: {
  label: string
  value: string
  trend?: "up" | "down"
  trendLabel?: string
  good?: boolean
  note?: string
}) {
  const Arrow = trend === "up" ? ArrowUpRight : ArrowDownRight
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        {trend && trendLabel ? (
          <>
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                good
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-rose-600 dark:text-rose-500"
              )}
            >
              <Arrow className="size-3" />
              {trendLabel}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">vs. semana anterior</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{note ?? "-"}</span>
        )}
      </CardContent>
    </Card>
  )
}

export default async function ApiOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string }>
}) {
  const params = await searchParams
  const granularity = parseGranularity(params.granularity)
  const [activeKeys, stats, statusMix, initialTimeSeries] = await Promise.all([
    countActiveApiKeys(),
    getOverviewStats(),
    getStatusMix24h(),
    getTimeSeries(granularity),
  ])

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Solicitudes (24h)"
          value={String(stats.requests24h)}
          note="últimas 24 horas"
        />
        <StatCard
          label="Llaves activas"
          value={String(activeKeys)}
          note="actual"
        />
        <StatCard
          label="Tasa de error"
          value={`${stats.errorRate24h}%`}
          note={`${stats.errorCount24h} de ${stats.requests24h} solicitudes`}
        />
        <StatCard
          label="Latencia promedio"
          value={`${stats.avgLatencyMs24h} ms`}
          note="últimas 24 horas"
        />
      </div>

      <OverviewTimeSeries
        initialTimeSeries={initialTimeSeries}
        initialStatusMix={statusMix}
        initialGranularity={granularity}
      />
    </div>
  )
}
