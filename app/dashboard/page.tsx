import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { LatencyChart } from "@/components/overview/latency-chart"
import { RequestVolumeChart } from "@/components/overview/request-volume-chart"
import { StatusMixChart } from "@/components/overview/status-mix-chart"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: "Overview · Dashboard",
  description: "API-as-a-service platform overview",
}

function StatCard({
  label,
  value,
  trend,
  trendLabel,
  good = true,
}: {
  label: string
  value: string
  trend: "up" | "down"
  trendLabel: string
  good?: boolean
}) {
  const Arrow = trend === "up" ? ArrowUpRight : ArrowDownRight
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
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
        <span className="ml-2 text-xs text-muted-foreground">vs. last week</span>
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Requests (24h)"
          value="1.28M"
          trend="up"
          trendLabel="12.5%"
        />
        <StatCard label="Active keys" value="8" trend="up" trendLabel="2" />
        <StatCard
          label="Error rate"
          value="0.42%"
          trend="down"
          trendLabel="0.08pp"
        />
        <StatCard
          label="Avg latency"
          value="142ms"
          trend="down"
          trendLabel="6ms"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestVolumeChart />
        </div>
        <div className="lg:col-span-1">
          <StatusMixChart />
        </div>
      </div>

      <LatencyChart />
    </div>
  )
}
