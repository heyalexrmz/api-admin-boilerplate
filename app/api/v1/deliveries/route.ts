import type { NextRequest } from "next/server";

import { listResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { listDeliveries } from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/deliveries";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) =>
      listResponse(await listDeliveries(ctx.organization.id), ctx.requestId),
  });
}
