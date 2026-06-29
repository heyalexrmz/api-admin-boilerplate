import type { NextRequest } from "next/server";

import { objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { enqueueTicketJob } from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/tickets/:id/refresh";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleApiRoute({
    req,
    method: "POST",
    path: PATH,
    requiredScope: "write",
    handler: async (ctx) => {
      await enqueueTicketJob({
        organizationId: ctx.organization.id,
        ticketId: id,
        type: "refresh_ticket",
      });
      return objectResponse("ticket_refresh", { ticket_id: id, queued: true }, ctx.requestId, {
        status: 202,
      });
    },
  });
}
