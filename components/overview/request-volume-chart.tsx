"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const data = [
  { date: "Jun 14", requests: 71200 },
  { date: "Jun 15", requests: 68400 },
  { date: "Jun 16", requests: 75800 },
  { date: "Jun 17", requests: 82100 },
  { date: "Jun 18", requests: 79600 },
  { date: "Jun 19", requests: 88300 },
  { date: "Jun 20", requests: 94500 },
  { date: "Jun 21", requests: 91200 },
  { date: "Jun 22", requests: 102400 },
  { date: "Jun 23", requests: 108900 },
  { date: "Jun 24", requests: 115600 },
  { date: "Jun 25", requests: 121300 },
  { date: "Jun 26", requests: 128400 },
  { date: "Jun 27", requests: 134200 },
]

const chartConfig = {
  requests: { label: "Requests", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RequestVolumeChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request volume</CardTitle>
        <CardDescription>Last 14 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
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
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="requests"
              type="natural"
              stroke="var(--color-requests)"
              fill="url(#fillRequests)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
