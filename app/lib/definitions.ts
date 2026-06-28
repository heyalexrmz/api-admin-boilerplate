import { z } from "zod"

const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." })
  .trim()

export const InviteFormSchema = z
  .object({
    name: z.string().min(2, { error: "Enter your full name." }).trim(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { error: "Confirm your password." }).trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export const SsoFormSchema = z.object({
  email: z.email({ error: "Enter your work email." }).trim(),
})

export type AuthFormState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
} | undefined

export type InviteState = AuthFormState
export type SsoState = AuthFormState

// --- API Keys ---------------------------------------------------------------

export const API_KEY_SCOPES = ["read", "write", "admin", "billing"] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

export const API_KEY_EXPIRIES = [
  "7d",
  "30d",
  "90d",
  "365d",
  "never",
] as const
export type ApiKeyExpiry = (typeof API_KEY_EXPIRIES)[number]

export type ApiKeyStatus = "active" | "revoked" | "expired"

export type ApiKey = {
  id: string
  name: string
  /** Masked preview, e.g. `sk_live_••••••••1234`. The full secret is never stored. */
  preview: string
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
})

export const RenameApiKeyFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Name can't be empty." })
    .max(40, { error: "Keep the name under 40 characters." })
    .trim(),
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
  ip: string
  userAgent: string
  requestHeaders: RequestHeader[]
  /** Raw request body (JSON string), or null for bodyless requests. */
  requestBody: string | null
  responseHeaders: RequestHeader[]
  /** Raw response body (JSON string), or null when empty. */
  responseBody: string | null
}

// --- Settings ---------------------------------------------------------------

export const TIMEZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const

export const ProfileFormSchema = z.object({
  name: z.string().min(2, { error: "Enter your full name." }).max(60).trim(),
  email: z.email({ error: "Enter a valid work email." }).trim(),
  timezone: z.string().min(1, { error: "Select a timezone." }),
  bio: z
    .string()
    .max(160, { error: "Keep your bio under 160 characters." })
    .trim()
    .optional(),
})

export type SettingsFormState = {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
} | undefined
