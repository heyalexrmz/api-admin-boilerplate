import { tick } from "./jobs";
import { tickRouterDelivery } from "@/lib/webhook-router/consumer";
import { getRouterConfig } from "@/lib/webhook-router/config";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

async function runLoop(name: string, work: () => Promise<unknown>) {
  while (!stopping) {
    try { await work(); }
    catch { console.error(`[worker] ${name} poll failed; retrying next poll`); }
    await sleep(POLL_INTERVAL_MS);
  }
}

async function main() {
  getRouterConfig();
  console.log("[worker] started");
  // Independent loops keep forwarding latency out of the ticket processing path.
  await Promise.all([
    runLoop("jobs", tick),
    runLoop("router-local", () => tickRouterDelivery("local")),
    runLoop("router-forward", () => tickRouterDelivery("forward")),
  ]);
  process.exit(0);
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
