import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { upstreamWebhookDelivery } from "@/lib/db/schema";

export type RouterDelivery = {
  id: string;
  event_id: string;
  destination: string;
  raw_body: string;
  attempts: number;
  max_attempts: number;
  locked_by: string;
};

export async function persistRouterDeliveries(input: { eventId: string; rawBody: string; destinations: string[] }) {
  const created = await db.insert(upstreamWebhookDelivery).values(input.destinations.map((destination) => ({
    eventId: input.eventId, rawBody: input.rawBody, destination,
  }))).onConflictDoNothing().returning({ id: upstreamWebhookDelivery.id });
  return created.length;
}

export async function claimRouterDelivery(destination: "local" | "forward"): Promise<RouterDelivery | null> {
  // Leases recover deliveries after a restart. Exhausted abandoned claims are visible as failed.
  await db.execute(sql`
    update upstream_webhook_delivery set status = 'failed', locked_at = null, locked_by = null,
      last_error = 'delivery_lease_expired'
    where status = 'running' and locked_at < now() - interval '5 minutes' and attempts >= max_attempts
  `);
  const result = await db.execute<RouterDelivery>(sql`
    update upstream_webhook_delivery set status = 'running', locked_at = now(), locked_by = ${randomUUID()},
      attempts = attempts + 1
    where id = (
      select id from upstream_webhook_delivery
      where ((${destination} = 'local' and destination = 'local') or (${destination} = 'forward' and destination <> 'local'))
        and attempts < max_attempts
        and ((status = 'pending' and run_at <= now()) or (status = 'running' and locked_at < now() - interval '5 minutes'))
      order by run_at, created_at for update skip locked limit 1
    ) returning id, event_id, destination, raw_body, attempts, max_attempts, locked_by
  `);
  return result.rows[0] ?? null;
}

export async function finishRouterDelivery(row: RouterDelivery, result:
  | { ok: true; httpStatus?: number }
  | { ok: false; error: string; httpStatus?: number; retryAfterSeconds?: number; permanent?: boolean }
) {
  const retry = !result.ok && !result.permanent && row.attempts < row.max_attempts;
  const delay = !result.ok ? Math.min(86_400, Math.max(Math.min(3600, 30 * 2 ** (row.attempts - 1)), result.retryAfterSeconds ?? 0)) : 0;
  await db.execute(sql`
    update upstream_webhook_delivery
    set status = ${result.ok ? "completed" : retry ? "pending" : "failed"},
        completed_at = ${result.ok ? new Date() : null},
        run_at = now() + ${delay} * interval '1 second',
        locked_at = null, locked_by = null,
        last_error = ${result.ok ? null : result.error}, http_status = ${result.httpStatus ?? null}
    where id = ${row.id} and status = 'running' and locked_by = ${row.locked_by}
  `);
}
