"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Gauge } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type LatencyPoint = { date: string; p50: number; p95: number }

const chartConfig = {
  p50: { label: "p50", color: "var(--chart-2)" },
  p95: { label: "p95", color: "var(--chart-4)" },
} satisfies ChartConfig

export function LatencyChart({
  data,
  range = "Last 14 days",
}: {
  data: LatencyPoint[]
  range?: string
}) {
  // Show point markers when there's little data, otherwise a lone bucket would
  // render as an invisible single-point line.
  const showDots = data.length <= 10
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency</CardTitle>
        <CardDescription>{`p50 and p95 · ${range}`}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
            <Gauge className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No latency data yet</p>
            <p className="text-xs text-muted-foreground">
              Latency percentiles will appear here once your APIs start receiving traffic.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(value) => `${value}ms`}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line dataKey="p50" type="natural" stroke="var(--color-p50)" strokeWidth={2} dot={showDots} />
              <Line dataKey="p95" type="natural" stroke="var(--color-p95)" strokeWidth={2} dot={showDots} />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
