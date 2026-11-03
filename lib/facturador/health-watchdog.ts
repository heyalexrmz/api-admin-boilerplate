import {
  clearServiceHealthCache,
  measureServiceHealth,
  publishServiceHealth,
  type ServiceMode,
} from "@/lib/facturador/service-health";
import { sweepStaleTickets } from "@/lib/facturador/stale-tickets";

export const WATCHDOG_INTERVAL_MS = Number(process.env.SERVICE_WATCHDOG_INTERVAL_MS ?? 15_000);
const MODES: ServiceMode[] = ["live", "test"];

/**
 * Measure availability, announce service.* transitions and close tickets that
 * exceeded their SLA. Runs in the worker, in the webhook router (so a stopped
 * worker is still detected), and opportunistically from the API.
 */
export async function runHealthWatchdog() {
  const results = await Promise.allSettled([
    ...MODES.map(async (mode) => publishServiceHealth(await measureServiceHealth(mode))),
    sweepStaleTickets(),
  ]);
  clearServiceHealthCache();
  for (const result of results) {
    if (result.status === "rejected") console.error("[health-watchdog] step failed", result.reason);
  }
}

let lastRunAt = 0;
let running: Promise<void> | null = null;

/** Start a watchdog run unless one ran in this process within the interval. */
export function triggerHealthWatchdog(defer?: (task: () => Promise<void>) => void) {
  if (running || Date.now() - lastRunAt < WATCHDOG_INTERVAL_MS) return;
  lastRunAt = Date.now();
  const task = async () => {
    running = runHealthWatchdog().finally(() => {
      running = null;
    });
    await running;
  };
  if (defer) defer(task);
  else task().catch((error) => console.error("[health-watchdog] run failed", error));
}
