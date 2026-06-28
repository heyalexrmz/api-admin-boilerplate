"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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

const data = [
  { date: "Jun 14", p50: 138, p95: 305 },
  { date: "Jun 15", p50: 135, p95: 298 },
  { date: "Jun 16", p50: 142, p95: 312 },
  { date: "Jun 17", p50: 130, p95: 288 },
  { date: "Jun 18", p50: 133, p95: 295 },
  { date: "Jun 19", p50: 128, p95: 280 },
  { date: "Jun 20", p50: 131, p95: 284 },
  { date: "Jun 21", p50: 126, p95: 276 },
  { date: "Jun 22", p50: 129, p95: 279 },
  { date: "Jun 23", p50: 124, p95: 270 },
  { date: "Jun 24", p50: 127, p95: 273 },
  { date: "Jun 25", p50: 122, p95: 265 },
  { date: "Jun 26", p50: 144, p95: 300 },
  { date: "Jun 27", p50: 142, p95: 296 },
]

const chartConfig = {
  p50: { label: "p50", color: "var(--chart-2)" },
  p95: { label: "p95", color: "var(--chart-4)" },
} satisfies ChartConfig

export function LatencyChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency</CardTitle>
        <CardDescription>p50 and p95 over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent>
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
            <Line dataKey="p50" type="natural" stroke="var(--color-p50)" strokeWidth={2} dot={false} />
            <Line dataKey="p95" type="natural" stroke="var(--color-p95)" strokeWidth={2} dot={false} />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
