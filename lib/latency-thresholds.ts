import type { LatencyThresholds } from "@/app/lib/definitions"

export const DEFAULT_LATENCY_THRESHOLDS: LatencyThresholds = {
  warningMs: 500,
  criticalMs: 1000,
}

export function latencyColor(ms: number, thresholds = DEFAULT_LATENCY_THRESHOLDS): string {
  if (ms >= thresholds.criticalMs) return "text-rose-600 dark:text-rose-400"
  if (ms >= thresholds.warningMs) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}
