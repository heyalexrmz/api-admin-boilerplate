import { tick, WORKER_ID } from "./jobs";
import { runHealthWatchdog, WATCHDOG_INTERVAL_MS } from "@/lib/facturador/health-watchdog";
import { pruneWorkerHeartbeats, recordWorkerHeartbeat } from "@/lib/facturador/service-health";
import { tickRouterDelivery } from "@/lib/webhook-router/consumer";
import { getRouterConfig } from "@/lib/webhook-router/config";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

async function runLoop(name: string, work: () => Promise<unknown>, intervalMs = POLL_INTERVAL_MS) {
  while (!stopping) {
    try { await work(); }
    catch { console.error(`[worker] ${name} poll failed; retrying next poll`); }
    await sleep(intervalMs);
  }
}

// The heartbeat is written by the job loop itself, so a stuck job loop shows
// up as stopped extraction in GET /api/v1/status.
async function jobsWithHeartbeat() {
  await recordWorkerHeartbeat(WORKER_ID);
  await tick();
}

async function main() {
  getRouterConfig();
  console.log("[worker] started");
  // Independent loops keep forwarding latency out of the ticket processing path.
  await Promise.all([
    runLoop("jobs", jobsWithHeartbeat),
    runLoop("health", async () => {
      await runHealthWatchdog();
      await pruneWorkerHeartbeats();
    }, WATCHDOG_INTERVAL_MS),
    runLoop("router-local", () => tickRouterDelivery("local")),
    runLoop("router-forward", () => tickRouterDelivery("forward")),
  ]);
  process.exit(0);
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
