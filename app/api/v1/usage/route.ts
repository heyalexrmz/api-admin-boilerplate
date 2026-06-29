import type { NextRequest } from "next/server";

import { objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { getUsage } from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/usage";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "billing",
    handler: async (ctx) =>
      objectResponse("usage", await getUsage(ctx.organization.id), ctx.requestId),
  });
}
