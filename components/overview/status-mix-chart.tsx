"use client"

import { Cell, Pie, PieChart } from "recharts"

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
  { status: "2xx", count: 1241000, fill: "var(--chart-1)" },
  { status: "4xx", count: 38400, fill: "var(--chart-3)" },
  { status: "5xx", count: 5133, fill: "var(--chart-5)" },
]

const chartConfig = {
  "2xx": { label: "2xx Success", color: "var(--chart-1)" },
  "4xx": { label: "4xx Client error", color: "var(--chart-3)" },
  "5xx": { label: "5xx Server error", color: "var(--chart-5)" },
} satisfies ChartConfig

const total = data.reduce((sum, item) => sum + item.count, 0)

export function StatusMixChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status codes</CardTitle>
        <CardDescription>Last 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[220px]"
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="status" hideLabel />}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={58}
                strokeWidth={4}
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">
              {(total / 1000).toFixed(0)}k
            </span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>
        <ChartLegend
          content={<ChartLegendContent nameKey="status" />}
          className="flex-wrap gap-2 pt-4 [&>*]:flex-1"
        />
      </CardContent>
    </Card>
  )
}
