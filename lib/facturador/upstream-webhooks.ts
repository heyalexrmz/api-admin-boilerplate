export const PROCESS_UPSTREAM_WEBHOOK_JOB = "process_upstream_webhook" as const;

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export function tocinoWebhookJobIdempotencyKey(raw: unknown): string | null {
  const payload = raw as Record<string, unknown>;
  const providerRequestId = stringValue(payload.nova_request_id);
  if (providerRequestId) {
    return `${PROCESS_UPSTREAM_WEBHOOK_JOB}:nova_request_id:${providerRequestId}`;
  }

  const idempotencyKey = stringValue(payload.idempotency_key);
  if (idempotencyKey) {
    return `${PROCESS_UPSTREAM_WEBHOOK_JOB}:idempotency_key:${idempotencyKey}`;
  }

  return null;
}

export function createTocinoWebhookJobValues(input: {
  organizationId: string;
  raw: unknown;
}) {
  return {
    organizationId: input.organizationId,
    type: PROCESS_UPSTREAM_WEBHOOK_JOB,
    payload: { raw: input.raw },
    idempotencyKey: tocinoWebhookJobIdempotencyKey(input.raw),
  };
}
