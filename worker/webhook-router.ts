import { getRouterConfig } from "@/lib/webhook-router/config";
import { createWebhookRouterServer } from "@/lib/webhook-router/server";
import { runHealthWatchdog, WATCHDOG_INTERVAL_MS } from "@/lib/facturador/health-watchdog";

getRouterConfig(); // Fail startup if authentication or destination configuration is invalid.
const port = Number(process.env.PORT ?? 10_000);
const server = createWebhookRouterServer();
server.listen(port, "0.0.0.0", () => console.log(`[webhook-router] listening on port ${port}`));
server.on("error", () => {
  console.error("[webhook-router] HTTP server failed");
  process.exit(1);
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
}
// Independent watchdog: if the worker stops, this process still marks
// extraction down, emits service.down and closes stale tickets.
const watchdog = setInterval(() => {
  runHealthWatchdog().catch(() => console.error("[webhook-router] health watchdog failed"));
}, WATCHDOG_INTERVAL_MS);
watchdog.unref();
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
