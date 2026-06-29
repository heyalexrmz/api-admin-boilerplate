"use server"

import { and, desc, eq, gt, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import { session } from "@/lib/db/schema"
import { getSession, requireUser } from "@/app/lib/auth"
import { describeUserAgent } from "@/lib/user-agent"
import { formatRelativeTime } from "@/lib/format"
import type { SessionView } from "@/app/lib/definitions"

type SessionRow = typeof session.$inferSelect

function toSessionView(row: SessionRow, currentSessionId: string): SessionView {
  const isCurrent = row.id === currentSessionId
  const { device, isMobile } = describeUserAgent(row.userAgent ?? null)

  return {
    id: row.id,
    device,
    isMobile,
    location: row.ipAddress ?? null,
    lastActive: isCurrent ? "Active now" : formatRelativeTime(row.updatedAt.toISOString()),
    current: isCurrent,
  }
}

export async function listSessions(): Promise<SessionView[]> {
  const active = await getSession()
  const user = await requireUser()
  if (!active) return []

  const rows = await db
    .select()
    .from(session)
    .where(and(eq(session.userId, user.id), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt))

  return rows.map((row) => toSessionView(row, active.session.id))
}

export async function revokeSession(
  id: string
): Promise<{ success: true } | { error: string }> {
  const active = await getSession()
  const user = await requireUser()

  if (!id) return { error: "Missing session id." }
  if (!active) return { error: "Not signed in." }
  if (id === active.session.id) return { error: "You can't revoke your current session here." }

  const [row] = await db
    .delete(session)
    .where(and(eq(session.id, id), eq(session.userId, user.id)))
    .returning({ id: session.id })

  if (!row) return { error: "Session not found." }
  return { success: true }
}

export async function revokeOtherSessions(): Promise<{ success: true; revoked: number } | { error: string }> {
  const active = await getSession()
  const user = await requireUser()
  if (!active) return { error: "Not signed in." }

  const rows = await db
    .delete(session)
    .where(and(eq(session.userId, user.id), ne(session.id, active.session.id)))
    .returning({ id: session.id })

  return { success: true, revoked: rows.length }
}
