"use client"

import { Cell, Pie, PieChart } from "recharts"
import { PieChart as PieChartIcon } from "lucide-react"

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
import { formatCompact } from "@/lib/format"

export type StatusMixPoint = {
  status: string
  count: number
  fill: string
}

const chartConfig = {
  "2xx": { label: "2xx Success", color: "var(--chart-1)" },
  "4xx": { label: "4xx Client error", color: "var(--chart-3)" },
  "5xx": { label: "5xx Server error", color: "var(--chart-5)" },
} satisfies ChartConfig

export function StatusMixChart({ data }: { data: StatusMixPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Status codes</CardTitle>
        <CardDescription>Last 24 hours</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {data.length === 0 || total === 0 ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 text-center">
            <PieChartIcon className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No request data yet</p>
            <p className="text-xs text-muted-foreground">
              Status code breakdown will appear here once your APIs start receiving traffic.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-1 flex-col">
            <div className="relative flex flex-1 items-center justify-center">
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square h-full max-h-[260px]"
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
                  {formatCompact(total)}
                </span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </div>
            <ChartLegend
              content={<ChartLegendContent nameKey="status" />}
              className="flex-wrap gap-2 pt-4 [&>*]:flex-1"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
