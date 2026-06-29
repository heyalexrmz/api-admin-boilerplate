import type { NextRequest } from "next/server";

import { ApiError, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { getTicket } from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/tickets/:id";

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
    handler: async (ctx) => {
      const ticket = await getTicket(ctx.organization.id, id);
      if (!ticket) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Ticket not found.",
        });
      }
      return objectResponse("ticket", ticket, ctx.requestId);
    },
  });
}
