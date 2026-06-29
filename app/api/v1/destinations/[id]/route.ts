import type { NextRequest } from "next/server";

import { ApiError, objectResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import {
  deleteDestination,
  DestinationUpdateSchema,
  getDestination,
  updateDestination,
} from "@/lib/facturador/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/destinations/:id";

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
      const destination = await getDestination(ctx.organization.id, id);
      if (!destination) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Destination not found.",
        });
      }
      return objectResponse("destination", destination, ctx.requestId);
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleApiRoute({
    req,
    method: "PATCH",
    path: PATH,
    requiredScope: "write",
    handler: async (ctx) => {
      const parsed = DestinationUpdateSchema.safeParse(await req.json());
      if (!parsed.success) {
        throw new ApiError({
          status: 400,
          code: "invalid_destination",
          type: "validation_error",
          message: "Invalid destination payload.",
        });
      }
      const destination = await updateDestination({
        organizationId: ctx.organization.id,
        id,
        body: parsed.data,
      });
      if (!destination) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Destination not found.",
        });
      }
      return objectResponse("destination", destination, ctx.requestId);
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleApiRoute({
    req,
    method: "DELETE",
    path: PATH,
    requiredScope: "write",
    handler: async (ctx) => {
      const destination = await deleteDestination(ctx.organization.id, id);
      if (!destination) {
        throw new ApiError({
          status: 404,
          code: "not_found",
          type: "validation_error",
          message: "Destination not found.",
        });
      }
      return objectResponse("destination", destination, ctx.requestId);
    },
  });
}
