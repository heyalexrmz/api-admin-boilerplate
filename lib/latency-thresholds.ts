import type { LatencyThresholds } from "@/app/lib/definitions"

export const DEFAULT_LATENCY_THRESHOLDS: LatencyThresholds = {
  warningMs: 500,
  criticalMs: 1000,
}

export function parseOrganizationMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function getLatencyThresholds(metadata: string | null): LatencyThresholds {
  const parsed = parseOrganizationMetadata(metadata)
  const thresholds = parsed.latencyThresholds as Partial<LatencyThresholds> | undefined
  return {
    warningMs:
      typeof thresholds?.warningMs === "number"
        ? thresholds.warningMs
        : DEFAULT_LATENCY_THRESHOLDS.warningMs,
    criticalMs:
      typeof thresholds?.criticalMs === "number"
        ? thresholds.criticalMs
        : DEFAULT_LATENCY_THRESHOLDS.criticalMs,
  }
}

export function latencyColor(ms: number, thresholds = DEFAULT_LATENCY_THRESHOLDS): string {
  if (ms >= thresholds.criticalMs) return "text-rose-600 dark:text-rose-400"
  if (ms >= thresholds.warningMs) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}
