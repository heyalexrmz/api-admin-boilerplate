import type { HttpMethod, RequestLog } from "@/app/lib/definitions"

// Deterministic mock data (no random / Date.now) so server and client render
// identically and avoid hydration mismatches.

let seq = 0

const IPS = [
  "54.241.22.13",
  "52.91.10.4",
  "176.32.78.9",
  "3.8.114.2",
  "13.58.4.7",
]

const USER_AGENTS: Record<string, string> = {
  "Production server": "axios/1.7 (node 20.10)",
  "CI pipeline": "curl/8.6.0",
  "Legacy webhook": "Go-http-client/1.1",
  "Mobile app (iOS)": "AcmeSDK/3.2 (iPhone15,3; iOS 17.4)",
}

function errType(status: number): string {
  switch (status) {
    case 400:
      return "invalid_request"
    case 401:
      return "authentication_error"
    case 404:
      return "not_found"
    case 429:
      return "rate_limit_error"
    case 500:
      return "api_error"
    case 503:
      return "service_unavailable"
    default:
      return "error"
  }
}

function errMessage(status: number): string {
  switch (status) {
    case 400:
      return "Missing required param: amount."
    case 401:
      return "Invalid API key provided."
    case 404:
      return "No such charge: ch_0001."
    case 429:
      return "Request rate limit exceeded. Retry after 30s."
    case 500:
      return "Unexpected internal error. Request id has been logged."
    case 503:
      return "Service temporarily unavailable. Please retry."
    default:
      return "Request failed."
  }
}

function makeLog(input: {
  timestamp: string
  method: HttpMethod
  path: string
  status: number
  latencyMs: number
  keyName: string
  ip?: string
  userAgent?: string
  requestBody?: string | null
  responseBody?: string | null
}): RequestLog {
  seq += 1
  const n = String(seq).padStart(4, "0")
  const id = `log_${n}`
  const requestId = `req_${n}`
  const token = `sk_live_${"•".repeat(8)}${n}`
  const ip = input.ip ?? IPS[(seq - 1) % IPS.length]
  const userAgent = input.userAgent ?? USER_AGENTS[input.keyName] ?? "axios/1.7"

  const requestHeaders = [
    { name: "Authorization", value: `Bearer ${token}` },
    { name: "Content-Type", value: "application/json" },
    { name: "Accept", value: "application/json" },
    { name: "Idempotency-Key", value: `key_${n}` },
    { name: "X-Request-Id", value: requestId },
  ]

  const responseHeaders = [
    { name: "Content-Type", value: "application/json" },
    { name: "X-Request-Id", value: requestId },
    { name: "Date", value: new Date(input.timestamp).toUTCString() },
    {
      name: "X-RateLimit-Remaining",
      value: input.status === 429 ? "0" : String(50 - (seq % 10)),
    },
  ]
  if (input.status === 429) {
    responseHeaders.push({ name: "Retry-After", value: "30" })
  }

  const hasBody =
    input.method === "POST" || input.method === "PUT" || input.method === "PATCH"
  const requestBody =
    input.requestBody !== undefined
      ? input.requestBody
      : hasBody
        ? `{"amount":4200,"currency":"usd"}`
        : null

  const isErr = input.status >= 400
  const responseBody =
    input.responseBody !== undefined
      ? input.responseBody
      : input.status === 204
        ? null
        : isErr
          ? `{"error":{"type":"${errType(input.status)}","message":"${errMessage(input.status)}"}}`
          : input.status === 201
            ? `{"id":"ch_${n}","object":"charge","status":"succeeded"}`
            : `{"object":"list","has_more":false,"data":[]}`

  return {
    id,
    requestId,
    timestamp: input.timestamp,
    method: input.method,
    path: input.path,
    status: input.status,
    latencyMs: input.latencyMs,
    keyName: input.keyName,
    ip,
    userAgent,
    requestHeaders,
    requestBody,
    responseHeaders,
    responseBody,
  }
}

export const MOCK_LOGS: RequestLog[] = [
  makeLog({ timestamp: "2026-06-28T19:05:42.000Z", method: "POST", path: "/v1/charges", status: 201, latencyMs: 142, keyName: "Production server" }),
  makeLog({ timestamp: "2026-06-28T19:05:31.000Z", method: "GET", path: "/v1/charges/ch_0001", status: 200, latencyMs: 86, keyName: "Production server" }),
  makeLog({ timestamp: "2026-06-28T19:05:12.000Z", method: "GET", path: "/v1/customers", status: 200, latencyMs: 73, keyName: "CI pipeline" }),
  makeLog({ timestamp: "2026-06-28T19:04:58.000Z", method: "POST", path: "/v1/refunds", status: 200, latencyMs: 211, keyName: "Production server", requestBody: '{"charge":"ch_0001","amount":1200}' }),
  makeLog({ timestamp: "2026-06-28T19:04:41.000Z", method: "DELETE", path: "/v1/customers/cu_12", status: 204, latencyMs: 64, keyName: "Production server" }),
  makeLog({ timestamp: "2026-06-28T19:04:22.000Z", method: "GET", path: "/v1/invoices", status: 200, latencyMs: 91, keyName: "Mobile app (iOS)" }),
  makeLog({ timestamp: "2026-06-28T19:04:03.000Z", method: "POST", path: "/v1/charges", status: 401, latencyMs: 38, keyName: "Legacy webhook" }),
  makeLog({ timestamp: "2026-06-28T19:03:51.000Z", method: "GET", path: "/v1/usage", status: 200, latencyMs: 124, keyName: "CI pipeline" }),
  makeLog({ timestamp: "2026-06-28T19:03:33.000Z", method: "PUT", path: "/v1/customers/cu_12", status: 200, latencyMs: 187, keyName: "Production server", requestBody: '{"email":"jane@company.com"}' }),
  makeLog({ timestamp: "2026-06-28T19:03:10.000Z", method: "POST", path: "/v1/webhooks/events", status: 200, latencyMs: 980, keyName: "Legacy webhook", requestBody: '{"type":"charge.succeeded","data":{"id":"ch_0001"}}', responseBody: '{"received":true}' }),
  makeLog({ timestamp: "2026-06-28T19:02:54.000Z", method: "GET", path: "/v1/charges", status: 429, latencyMs: 24, keyName: "Mobile app (iOS)" }),
  makeLog({ timestamp: "2026-06-28T19:02:38.000Z", method: "POST", path: "/v1/charges", status: 400, latencyMs: 41, keyName: "Production server", requestBody: '{"currency":"usd"}' }),
  makeLog({ timestamp: "2026-06-28T19:02:15.000Z", method: "GET", path: "/v1/customers/cu_99", status: 404, latencyMs: 52, keyName: "CI pipeline" }),
  makeLog({ timestamp: "2026-06-28T19:01:52.000Z", method: "POST", path: "/v1/charges", status: 500, latencyMs: 1210, keyName: "Production server" }),
  makeLog({ timestamp: "2026-06-28T19:01:29.000Z", method: "GET", path: "/v1/keys", status: 200, latencyMs: 68, keyName: "Production server" }),
  makeLog({ timestamp: "2026-06-28T19:00:55.000Z", method: "PATCH", path: "/v1/customers/cu_12", status: 200, latencyMs: 159, keyName: "Mobile app (iOS)", requestBody: '{"metadata":{"plan":"pro"}}' }),
]
