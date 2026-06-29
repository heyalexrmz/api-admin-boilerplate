"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Activity } from "lucide-react"

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
import { formatCompact } from "@/lib/format"

export type RequestVolumePoint = { date: string; requests: number }

const chartConfig = {
  requests: { label: "Requests", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RequestVolumeChart({
  data,
  range = "Last 14 days",
}: {
  data: RequestVolumePoint[]
  range?: string
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Request volume</CardTitle>
        <CardDescription>{range}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {data.length === 0 ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 text-center">
            <Activity className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No request data yet</p>
            <p className="text-xs text-muted-foreground">
              Request volume will appear here once your APIs start receiving traffic.
            </p>
          </div>
        ) : (
          <div className="min-h-[240px] flex-1">
            <ChartContainer config={chartConfig} className="h-full w-full">
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
                  domain={[0, "auto"]}
                  tickFormatter={(value) => formatCompact(Number(value))}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  dataKey="requests"
                  type="linear"
                  baseValue={0}
                  stroke="var(--color-requests)"
                  fill="url(#fillRequests)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
