import type { NextRequest } from "next/server";
import { after } from "next/server";

import { ApiError, objectResponse, listResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import {
  createTicketFromFormData,
  createTicketFromJson,
  listTickets,
} from "@/lib/facturador/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/tickets";

export async function GET(req: NextRequest) {
  return handleApiRoute({
    req,
    method: "GET",
    path: PATH,
    requiredScope: "read",
    handler: async (ctx) => {
      const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
      const status = req.nextUrl.searchParams.get("status");
      const tickets = await listTickets({
        organizationId: ctx.organization.id,
        limit,
        status,
      });
      return listResponse(tickets, ctx.requestId);
    },
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  return handleApiRoute({
    req,
    method: "POST",
    path: PATH,
    requiredScope: "write",
    requestBodyForLog: isJson ? "[json body omitted]" : "[multipart body omitted]",
    handler: async (ctx) => {
      const baseInput = {
        organizationId: ctx.organization.id,
        apiKeyId: ctx.key.id,
        mode: ctx.mode,
        requestId: ctx.requestId,
        idempotencyKey: req.headers.get("Idempotency-Key"),
        defer: after,
      } as const;
      const ticket = isJson
        ? await createTicketFromJson({
            ...baseInput,
            body: await req.json().catch(() => {
              throw new ApiError({
                status: 400,
                code: "invalid_json",
                type: "validation_error",
                message: "Request body must be valid JSON.",
              });
            }),
          })
        : await createTicketFromFormData({
            ...baseInput,
            formData: await req.formData(),
          });
      return objectResponse("ticket", ticket, ctx.requestId, { status: 201 });
    },
  });
}
