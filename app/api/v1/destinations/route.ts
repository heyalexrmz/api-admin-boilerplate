import type { NextRequest } from "next/server";

import { ApiError, listResponse, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import {
  createDestination,
  DestinationCreateSchema,
  listDestinations,
} from "@/lib/facturador/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) =>
      listResponse(await listDestinations(ctx.organization.id), ctx.requestId),
  });
}

export async function POST(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "POST",
    path: PATH,
    requiredScope: "write",
    handler: async (ctx) => {
      const parsed = DestinationCreateSchema.safeParse(await req.json());
      if (!parsed.success) {
        throw new ApiError({
          status: 400,
          code: "invalid_destination",
          type: "validation_error",
          message: "Invalid destination payload.",
        });
      }
      const result = await createDestination({
        organizationId: ctx.organization.id,
        apiKeyId: ctx.key.id,
        body: parsed.data,
      });
      return objectResponse(
        "destination",
        { ...result.destination, secret: result.secret },
        ctx.requestId,
        { status: 201 }
      );
    },
  });
}
