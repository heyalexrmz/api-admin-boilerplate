import type { NextRequest } from "next/server";
import { after } from "next/server";

import { handleApiRoute } from "@/lib/api-route-handler";
import { triggerHealthWatchdog } from "@/lib/facturador/health-watchdog";
import { getServiceHealth } from "@/lib/facturador/service-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/status";

/**
 * Availability measured from recent real outcomes (worker liveness, queue lag,
 * invoicing results) for the mode of the calling key. Always HTTP 200 while
 * the API itself answers; a 5xx or timeout from this endpoint means down.
 */
export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) => {
      triggerHealthWatchdog(after);
      const health = await getServiceHealth(ctx.mode);
      return Response.json(
        {
          status: health.status,
          components: health.components,
          retry_after_seconds: health.retry_after_seconds,
          livemode: ctx.livemode,
          updated_at: health.updated_at,
          request_id: ctx.requestId,
        },
        {
          headers: {
            "Cache-Control": "no-store",
            ...(health.retry_after_seconds ? { "Retry-After": String(health.retry_after_seconds) } : {}),
          },
        }
      );
    },
  });
}
