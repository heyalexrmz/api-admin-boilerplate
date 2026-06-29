import type { NextRequest } from "next/server";

import { ApiError, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { rotateDestinationSecret } from "@/lib/facturador/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations/:id/rotate-secret";

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
      const result = await rotateDestinationSecret(ctx.organization.id, id);
      if (!result) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Destination not found.",
        });
      }
      return objectResponse(
        "destination_secret",
        { id, secret: result.secret, destination: result.destination },
        ctx.requestId
      );
    },
  });
}
