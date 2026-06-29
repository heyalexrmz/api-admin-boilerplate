import type { NextRequest } from "next/server";

import { objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { getStats } from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/stats";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) => {
      const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
      return objectResponse("stats", await getStats(ctx.organization.id, days), ctx.requestId);
    },
  });
}
