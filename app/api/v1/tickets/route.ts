import type { NextRequest } from "next/server";
import { after } from "next/server";

import { objectResponse, listResponse } from "@/lib/api-contracts";
import { handleApiRoute } from "@/lib/api-route-handler";
import { createTicketFromFormData, listTickets } from "@/lib/facturador/core";

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
  return handleApiRoute({
    req,
    method: "POST",
    path: PATH,
    requiredScope: "write",
    requestBodyForLog: "[multipart body omitted]",
    handler: async (ctx) => {
      const ticket = await createTicketFromFormData({
        organizationId: ctx.organization.id,
        apiKeyId: ctx.key.id,
        mode: ctx.mode,
        requestId: ctx.requestId,
        formData: await req.formData(),
        defer: after,
      });
      return objectResponse("ticket", ticket, ctx.requestId, { status: 201 });
    },
  });
}
