import { z } from "zod"

import { isValidWebhookUrlSyntax } from "@/lib/webhook-url-policy"

export const SsoFormSchema = z.object({
  email: z.email({ error: "Enter your work email." }).trim(),
})

export type AuthFormState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
} | undefined

export type SsoState = AuthFormState

export const OnboardingFormSchema = z.object({
  firstName: z
    .string()
    .min(1, { error: "Enter your first name." })
    .max(60, { error: "Keep it under 60 characters." })
    .trim(),
  lastName: z
    .string()
    .min(1, { error: "Enter your last name." })
    .max(60, { error: "Keep it under 60 characters." })
    .trim(),
  name: z
    .string()
    .min(2, { error: "Use at least 2 characters." })
    .max(60, { error: "Keep the name under 60 characters." })
    .trim(),
})

// --- API Keys ---------------------------------------------------------------

export const API_KEY_SCOPES = ["access"] as const
export type ApiKeyScope =
  | (typeof API_KEY_SCOPES)[number]
  | "read"
  | "write"
  | "admin"
  | "billing"

export const API_KEY_EXPIRIES = [
  "7d",
  "30d",
  "90d",
  "365d",
  "never",
] as const
export type ApiKeyExpiry = (typeof API_KEY_EXPIRIES)[number]
export const API_KEY_MODES = ["live", "test"] as const

export type ApiKeyStatus = "active" | "revoked" | "expired"
export type ApiKeyMode = "live" | "test"

export type ApiKey = {
  id: string
  name: string
  /** Masked preview, e.g. `sk_live_••••••••1234`. The full secret is never stored. */
  preview: string
  mode: ApiKeyMode
  scopes: ApiKeyScope[]
  /** ISO timestamp, or null when the key never expires. */
  expiresAt: string | null
  createdAt: string
  lastUsedAt: string | null
  /** ISO timestamp of the last secret rotation, or null if never rotated. */
  lastRotatedAt: string | null
  status: ApiKeyStatus
}

/** Returned exactly once, right after creation. Carries the plaintext secret. */
export type NewApiKey = Omit<ApiKey, "preview" | "status"> & {
  secret: string
}

/**
 * Returned exactly once after a rotation. Carries the new plaintext secret and
 * the new masked preview so the client can show the secret once and update the
 * row without a refetch.
 */
export type RotatedApiKey = {
  id: string
  secret: string
  preview: string
  lastRotatedAt: string
}

export const ApiKeyScopeLabels: Record<ApiKeyScope, string> = {
  access: "General access",
  read: "Read",
  write: "Write",
  admin: "Admin",
  billing: "Billing",
}

export const ApiKeyExpiryLabels: Record<ApiKeyExpiry, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "365d": "1 year",
  never: "Never",
}

export const ApiKeyModeLabels: Record<ApiKeyMode, string> = {
  live: "Live",
  test: "Test",
}

export const CreateApiKeyFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Give your key a name." })
    .max(40, { error: "Keep the name under 40 characters." })
    .trim(),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, { error: "Select at least one scope." }),
  expiry: z.enum(API_KEY_EXPIRIES),
  mode: z.enum(API_KEY_MODES),
})

export const RenameApiKeyFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Name can't be empty." })
    .max(40, { error: "Keep the name under 40 characters." })
    .trim(),
})

export const UpdateApiKeyScopesFormSchema = z.object({
  id: z.uuid(),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, { error: "Select at least one scope." }),
})

export type CreateApiKeyState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  key?: NewApiKey
} | undefined

export type RenameApiKeyState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  name?: string
} | undefined

export type UpdateApiKeyScopesState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  scopes?: ApiKeyScope[]
} | undefined

export type ApiKeyActionResponse = {
  success?: boolean
  error?: string
}

// --- Logs ------------------------------------------------------------------

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export type RequestHeader = {
  name: string
  value: string
}

export type RequestLog = {
  id: string
  requestId: string
  /** ISO timestamp of the request. */
  timestamp: string
  method: HttpMethod
  path: string
  /** HTTP response status code. */
  status: number
  /** Round-trip latency in milliseconds. */
  latencyMs: number
  /** Name of the API key that authenticated the request. */
  keyName: string
  keyMode: ApiKeyMode | null
  ip: string
  userAgent: string
  requestHeaders: RequestHeader[]
  /** Raw request body (JSON string), or null for bodyless requests. */
  requestBody: string | null
  responseHeaders: RequestHeader[]
  /** Raw response body (JSON string), or null when empty. */
  responseBody: string | null
}

// --- Webhooks ---------------------------------------------------------------

export const WEBHOOK_EVENTS = [
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
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export type WebhookStatus = "active" | "disabled"

export type Webhook = {
  id: string
  name: string
  url: string
  description: string | null
  events: WebhookEvent[]
  enabled: boolean
  /** Masked signing-secret preview, e.g. `whsec_••••••••1234`. */
  secretPreview: string
  createdAt: string
  updatedAt: string
  lastFiredAt: string | null
  /** ISO timestamp of the last secret rotation, or null if never rotated. */
  lastRotatedAt: string | null
  status: WebhookStatus
}

/** Returned exactly once, right after creation. Carries the plaintext secret. */
export type NewWebhook = {
  id: string
  name: string
  url: string
  description: string | null
  events: WebhookEvent[]
  enabled: boolean
  secret: string
  createdAt: string
  lastRotatedAt: string | null
}

/** Returned exactly once after a rotation. Carries the new plaintext secret. */
export type RotatedWebhookSecret = {
  id: string
  secret: string
  preview: string
  lastRotatedAt: string
}

export const WebhookEventLabels: Record<WebhookEvent, string> = {
  "api_key.created": "API key created",
  "api_key.rotated": "API key rotated",
  "api_key.revoked": "API key revoked",
  "member.invited": "Member invited",
  "member.removed": "Member removed",
  "taxpayer.created": "Taxpayer created",
  "taxpayer.updated": "Taxpayer updated",
  "ticket.created": "Ticket created",
  "ticket.processing": "Ticket processing",
  "ticket.finalized": "Ticket finalized",
  "ticket.failed": "Ticket failed",
  "invoice.created": "Invoice created",
  "invoice.finalized": "Invoice finalized",
  "invoice.failed": "Invoice failed",
  "document.created": "Document created",
  "document.attached": "Document attached",
  "document.failed": "Document failed",
  "delivery.created": "Delivery created",
  "delivery.succeeded": "Delivery succeeded",
  "delivery.failed": "Delivery failed",
  "delivery.exhausted": "Delivery exhausted",
}

export const CreateWebhookFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Give your webhook a name." })
    .max(40, { error: "Keep the name under 40 characters." })
    .trim(),
  url: z
    .url({ error: "Enter a valid URL." })
    .refine(isValidWebhookUrlSyntax, {
      error: "Webhook URLs must use a public HTTPS endpoint.",
    }),
  description: z
    .string()
    .max(160, { error: "Keep the description under 160 characters." })
    .trim()
    .optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, { error: "Select at least one event to subscribe to." }),
})

export const UpdateWebhookFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Name can't be empty." })
    .max(40, { error: "Keep the name under 40 characters." })
    .trim(),
  url: z
    .url({ error: "Enter a valid URL." })
    .refine(isValidWebhookUrlSyntax, {
      error: "Webhook URLs must use a public HTTPS endpoint.",
    }),
  description: z
    .string()
    .max(160, { error: "Keep the description under 160 characters." })
    .trim()
    .optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, { error: "Select at least one event to subscribe to." }),
})

export type UpdatedWebhook = {
  name: string
  url: string
  description: string | null
  events: WebhookEvent[]
}

export type CreateWebhookState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  webhook?: NewWebhook
} | undefined

export type UpdateWebhookState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  webhook?: UpdatedWebhook
} | undefined

/** Result of delivering a test event: the recorded log + updated last-delivery
 *  timestamp, or an error message. */
export type TestEventResult =
  | { eventLog: WebhookEventLog; lastFiredAt: string }
  | { error: string }

// --- Webhook Event Logs -----------------------------------------------------

export type WebhookEventLogStatus = "success" | "failed" | "pending" | "retrying"

export type WebhookEventLog = {
  id: string
  webhookId: string
  /** Unique id of the delivered event, sent in the payload headers. */
  eventId: string
  /** Event type, e.g. `api_key.created`. */
  eventType: string
  status: WebhookEventLogStatus
  /** HTTP status code returned by the endpoint, or null if not delivered. */
  httpStatus: number | null
  attemptCount: number
  /** Round-trip latency in milliseconds, or null if not delivered. */
  latencyMs: number | null
  /** The JSON payload that was sent. */
  payload: unknown
  responseHeaders: { name: string; value: string }[] | null
  responseBody: string | null
  createdAt: string
  deliveredAt: string | null
}

export const WebhookEventLogStatusLabels: Record<WebhookEventLogStatus, string> = {
  success: "Success",
  failed: "Failed",
  pending: "Pending",
  retrying: "Retrying",
}

// --- Settings ---------------------------------------------------------------

export type SettingsUser = {
  firstName: string | null
  lastName: string | null
  email: string
  timezone: string | null
  bio: string | null
}

export const ProfileFormSchema = z.object({
  firstName: z
    .string()
    .min(1, { error: "Enter your first name." })
    .max(60, { error: "Keep it under 60 characters." })
    .trim(),
  lastName: z
    .string()
    .min(1, { error: "Enter your last name." })
    .max(60, { error: "Keep it under 60 characters." })
    .trim(),
})

export type SettingsFormState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
  firstName?: string
  lastName?: string
} | undefined

// --- Sessions ----------------------------------------------------------------

export type SessionView = {
  id: string
  /** Short human-readable device label derived from the user agent. */
  device: string
  /** Coarse location label (city/region or country) derived from the IP, or null. */
  location: string | null
  /** Relative-time label for the session's last activity, e.g. "Active now". */
  lastActive: string
  /** True for the session matching the current request's cookie. */
  current: boolean
  /** Whether the session was made from a mobile device. */
  isMobile: boolean
}

// --- Organization ------------------------------------------------------------

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]
export type PlatformRole = "user" | "superadmin"

export const OrganizationRoleLabels: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

export type LatencyThresholds = {
  warningMs: number
  criticalMs: number
}

export type DashboardTicket = {
  id: string
  taxId: string
  status: string
  livemode: boolean
  originalFileName: string | null
  providerRequestId: string | null
  errorCode: string | null
  errorMessage: string | null
  invoiceId: string | null
  invoiceUuid: string | null
  documentCount: number
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

export type DashboardTicketOverview = {
  total: number
  last24h: number
  finalized: number
  active: number
  failed: number
  live: number
  sandbox: number
  recentTickets: DashboardTicket[]
}

export type DashboardInvoice = {
  id: string
  ticketId: string
  taxId: string
  status: string
  uuid: string | null
  series: string | null
  folio: string | null
  issuerTaxpayer: string | null
  issuerRfc: string | null
  total: string | null
  invoiceDate: string | null
  documentCount: number
  createdAt: string
  updatedAt: string
}

export type DashboardDocument = {
  id: string
  kind: string
  originalFileName: string
  contentType: string
  bytes: number | null
  url: string
  createdAt: string
}

export type DashboardTicketDetail = DashboardTicket & {
  submitRequest: unknown
  lastResponse: unknown
  upstreamRaw: unknown
  documents: DashboardDocument[]
  invoice: DashboardInvoice | null
}

export type DashboardInvoiceDetail = DashboardInvoice & {
  metadata: unknown
  documents: DashboardDocument[]
}

/** Roles an admin/owner can assign when inviting a new member. */
export const INVITABLE_ROLES = ["admin", "member"] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export type OrganizationDetails = {
  id: string
  name: string
  slug: string
  /** Logo URL or null. Always null for now — image upload isn't supported yet. */
  logo: string | null
  /** Hex accent color for avatars and badges. */
  color: string
}

export type TeamMember = {
  id: string
  userId: string
  name: string
  email: string
  role: OrganizationRole
  /** ISO timestamp of when the member joined the organization. */
  joinedAt: string
  /** True when this row is the currently signed-in user. */
  isCurrentUser: boolean
}

export type TeamInvitation = {
  id: string
  email: string
  role: OrganizationRole
  status: "pending" | "accepted" | "rejected" | "canceled"
  /** ISO timestamp of when the invitation was created. */
  createdAt: string
  /** ISO timestamp of when the invitation expires, or null when it never does. */
  expiresAt: string | null
  /** True when the signed-in user can cancel this invitation. */
  canCancel: boolean
}

export const UpdateOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Use at least 2 characters." })
    .max(60, { error: "Keep the name under 60 characters." })
    .trim(),
})

export type UpdateOrganizationState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
  name?: string
} | undefined

export const InviteMemberFormSchema = z.object({
  email: z.email({ error: "Enter a valid work email." }).trim(),
  role: z.enum(INVITABLE_ROLES),
})

export type InviteMemberState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
  invitation?: TeamInvitation
} | undefined

export type MemberActionResponse =
  | { success: true }
  | { error: string }

export type UpdateMemberRoleResponse =
  | { success: true; role: OrganizationRole }
  | { error: string }

// --- Invitations -------------------------------------------------------------

export type InvitationDetails = {
  id: string
  email: string
  inviterName: string
  workspaceName: string
}
