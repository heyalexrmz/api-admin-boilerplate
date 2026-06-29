import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { ApiError, errorResponse } from "@/lib/api-contracts";
import { db } from "@/lib/db";
import { document } from "@/lib/db/schema";
import { verifySignedDocumentUrl } from "@/lib/storage/document-links";
import { S3DocumentStore } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = req.headers.get("x-request-id") ?? "req_document_download";
  const { id } = await params;
  const expiresAt = Number(req.nextUrl.searchParams.get("exp"));
  const signature = req.nextUrl.searchParams.get("sig") ?? "";

  if (!verifySignedDocumentUrl({ documentId: id, expiresAt, signature })) {
    return errorResponse(
      new ApiError({
        status: 403,
        code: "invalid_document_signature",
        type: "authorization_error",
        message: "Invalid or expired document signature.",
      }),
      requestId
    );
  }

  const [row] = await db.select().from(document).where(eq(document.id, id));
  if (!row) {
    return errorResponse(
      new ApiError({
        status: 404,
        code: "not_found",
        type: "validation_error",
        message: "Document not found.",
      }),
      requestId
    );
  }

  const body = await new S3DocumentStore().getStream(row.storageKey);
  const stream = body instanceof Readable ? Readable.toWeb(body) : body;

  return new Response(stream as BodyInit, {
    headers: {
      "content-type": row.contentType,
      "content-disposition": `attachment; filename="${row.originalFileName.replace(/"/g, "")}"`,
      "x-request-id": requestId,
    },
  });
}
