import type { NextRequest } from "next/server";

import { listResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { listDestinationDeliveries } from "@/lib/facturador/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations/:id/deliveries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) =>
      listResponse(
        await listDestinationDeliveries(ctx.organization.id, id),
        ctx.requestId
      ),
  });
}
