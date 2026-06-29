import type { NextRequest } from "next/server";

import { ApiError, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { sendDestinationTestEvent } from "@/lib/facturador/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations/:id/test";

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
      const eventLog = await sendDestinationTestEvent({
        organizationId: ctx.organization.id,
        id,
        livemode: ctx.livemode,
        requestId: ctx.requestId,
      });
      if (!eventLog) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Destination not found.",
        });
      }
      return objectResponse(
        "delivery",
        {
          id: eventLog.id,
          event_id: eventLog.eventId,
          status: eventLog.status,
          http_status: eventLog.httpStatus,
        },
        ctx.requestId
      );
    },
  });
}
