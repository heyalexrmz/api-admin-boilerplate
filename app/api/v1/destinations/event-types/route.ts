import type { NextRequest } from "next/server";

import { FACTURADOR_WEBHOOK_EVENTS, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations/event-types";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) =>
      objectResponse(
        "event_type_catalog",
        { event_types: FACTURADOR_WEBHOOK_EVENTS },
        ctx.requestId
      ),
  });
}
