import { db } from "@/lib/db";
import { runHealthWatchdog } from "@/lib/facturador/health-watchdog";
import {
  clearServiceOverride,
  setServiceOverride,
  type ComponentName,
  type ServiceMode,
} from "@/lib/facturador/service-health";

const USAGE = `Usage:
  pnpm service:override set <live|test> <ingest|extraction|invoicing> <down|degraded> "<public reason>" [minutes]
  pnpm service:override clear <live|test> [component]

Declares an incident or switches a component off (e.g. extraction in the
sandbox). The reason is shown to integrators in GET /api/v1/status and in
service.* webhooks: write it in Spanish, without vendor names.`;

const MODES = new Set(["live", "test"]);
const COMPONENTS = new Set(["ingest", "extraction", "invoicing"]);

async function main() {
  const [action, mode, component, status, reason, minutes] = process.argv.slice(2);
  if (!MODES.has(mode ?? "")) throw new Error(USAGE);
  if (action === "set") {
    if (!COMPONENTS.has(component ?? "") || !["down", "degraded"].includes(status ?? "") || !reason) {
      throw new Error(USAGE);
    }
    await setServiceOverride({
      mode: mode as ServiceMode,
      component: component as ComponentName,
      status: status as "down" | "degraded",
      reason,
      expiresAt: minutes ? new Date(Date.now() + Number(minutes) * 60_000) : null,
    });
  } else if (action === "clear") {
    if (component && !COMPONENTS.has(component)) throw new Error(USAGE);
    await clearServiceOverride({ mode: mode as ServiceMode, component: component as ComponentName | undefined });
  } else {
    throw new Error(USAGE);
  }
  // Publish the change (and its service.* webhook) right away.
  await runHealthWatchdog();
  console.log(`service override ${action} applied for ${mode}${component ? `/${component}` : ""}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
