export const API_VERSION = "2026-06-28";

export const FACTURADOR_WEBHOOK_EVENTS = [
  "api_key.created",
  "api_key.rotated",
  "api_key.revoked",
  "member.invited",
  "member.removed",
  "taxpayer.created",
  "taxpayer.updated",
  "ticket.created",
  "ticket.processing",
  "ticket.finalized",
  "ticket.failed",
  "invoice.created",
  "invoice.finalized",
  "invoice.failed",
  "document.created",
  "document.attached",
  "document.failed",
  "delivery.created",
  "delivery.succeeded",
  "delivery.failed",
  "delivery.exhausted",
  "service.degraded",
  "service.down",
  "service.recovered",
] as const;

export type FacturadorWebhookEvent = (typeof FACTURADOR_WEBHOOK_EVENTS)[number];

export type ApiErrorType =
  | "authentication_error"
  | "authorization_error"
  | "validation_error"
  | "conflict_error"
  | "rate_limit_error"
  | "processing_error"
  | "unavailable"
  | "internal_error";

export type ApiErrorBody = {
  error: {
    code: string;
    type: ApiErrorType;
    message: string;
    param?: string | null;
    retryable: boolean;
  };
  request_id: string;
};

export type ApiObjectEnvelope<T> = {
  object: string;
  data: T;
  request_id: string;
};

export type ApiListEnvelope<T> = {
  object: "list";
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
  request_id: string;
};

export type EventEnvelope<T extends Record<string, unknown>> = {
  id: string;
  object: "event";
  api_version: typeof API_VERSION;
  type: FacturadorWebhookEvent;
  created: string;
  livemode: boolean;
  data: {
    object: T;
  };
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly type: ApiErrorType;
  readonly param?: string | null;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly logReason?: string;

  constructor(input: {
    status: number;
    code: string;
    type: ApiErrorType;
    message: string;
    param?: string | null;
    /** Whether repeating the same request (same Idempotency-Key and body) can succeed. */
    retryable?: boolean;
    /** Sent as the Retry-After header. */
    retryAfterSeconds?: number;
    /** Written to the request log only; never sent to the client or built from personal data. */
    logReason?: string;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.type = input.type;
    this.param = input.param;
    this.retryable = input.retryable ?? defaultRetryable(input.status);
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.logReason = input.logReason;
  }
}

// 5xx and 429 responses never commit a resource, so the same request may be repeated.
function defaultRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export function objectResponse<T>(
  object: string,
  data: T,
  requestId: string,
  init?: ResponseInit
): Response {
  return Response.json(
    { object, data, request_id: requestId } satisfies ApiObjectEnvelope<T>,
    init
  );
}

export function listResponse<T>(
  data: T[],
  requestId: string,
  input: { hasMore?: boolean; nextCursor?: string | null } = {},
  init?: ResponseInit
): Response {
  return Response.json(
    {
      object: "list",
      data,
      has_more: input.hasMore ?? false,
      next_cursor: input.nextCursor ?? null,
      request_id: requestId,
    } satisfies ApiListEnvelope<T>,
    init
  );
}

export function errorResponse(error: ApiError, requestId: string): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        type: error.type,
        message: error.message,
        param: error.param ?? null,
        retryable: error.retryable,
      },
      request_id: requestId,
    } satisfies ApiErrorBody,
    {
      status: error.status,
      headers:
        error.retryAfterSeconds !== undefined
          ? { "Retry-After": String(Math.max(1, Math.ceil(error.retryAfterSeconds))) }
          : undefined,
    }
  );
}

export function internalErrorResponse(requestId: string): Response {
  return errorResponse(
    new ApiError({
      status: 500,
      code: "internal_error",
      type: "internal_error",
      message: "An unexpected error occurred.",
    }),
    requestId
  );
}
