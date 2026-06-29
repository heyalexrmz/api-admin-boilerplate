import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { submitTicketToTocino } from "@/lib/facturador/core";

const WORKER_ID = `worker_${randomUUID()}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);

type JobRow = {
  id: string;
  organization_id: string;
  type: "submit_ticket" | "refresh_ticket" | "redeliver_ticket" | "dispatch_webhook";
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimJob(): Promise<JobRow | null> {
  const result = await db.execute<JobRow>(sql`
    update job
    set status = 'running',
        locked_at = now(),
        locked_by = ${WORKER_ID},
        attempts = attempts + 1,
        updated_at = now()
    where id = (
      select id
      from job
      where status = 'pending'
        and run_at <= now()
      order by run_at asc, created_at asc
      for update skip locked
      limit 1
    )
    returning id, organization_id, type, payload, attempts, max_attempts
  `);
  return result.rows[0] ?? null;
}

async function completeJob(id: string) {
  await db.execute(sql`
    update job
    set status = 'completed',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = ${id}
  `);
}

async function failJob(row: JobRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const retry = row.attempts < row.max_attempts;
  console.error(
    `[worker] failed job=${row.id} type=${row.type} attempt=${row.attempts}/${row.max_attempts} retry=${retry} error=${message}`
  );
  await db.execute(sql`
    update job
    set status = ${retry ? "pending" : "failed"},
        run_at = now() + interval '30 seconds',
        locked_at = null,
        locked_by = null,
        last_error = ${message},
        updated_at = now()
    where id = ${row.id}
  `);
}

async function processJob(row: JobRow) {
  if (row.type === "submit_ticket") {
    const ticketId = String(row.payload.ticketId ?? "");
    if (!ticketId) throw new Error("submit_ticket job missing ticketId");
    console.log(`[worker] submitting ticket=${ticketId} job=${row.id}`);
    const result = await submitTicketToTocino({
      organizationId: row.organization_id,
      ticketId,
    });
    if (result?.outcome === "tocino_pending") {
      console.log(
        `[worker] tocino accepted ticket=${ticketId} status=pending nova_request_id=${result.novaRequestId}`
      );
    } else if (result?.outcome === "tocino_failed") {
      console.log(
        `[worker] tocino rejected ticket=${ticketId} code=${result.errorCode} message=${result.errorMessage}`
      );
    } else if (result?.outcome === "sandbox_finalized") {
      console.log(`[worker] sandbox finalized ticket=${ticketId}`);
    } else {
      console.log(`[worker] submit_ticket no-op ticket=${ticketId}`);
    }
    return;
  }

  // Refresh/redelivery real provider work is intentionally deferred until the
  // provider callback exists. Mark no-op jobs complete so the queue drains.
  console.log(`[worker] no-op job=${row.id} type=${row.type}`);
}

async function tick() {
  const row = await claimJob();
  if (!row) return;
  console.log(
    `[worker] claimed job=${row.id} type=${row.type} attempt=${row.attempts + 1}/${row.max_attempts}`
  );

  try {
    await processJob(row);
    await completeJob(row.id);
    console.log(`[worker] completed job=${row.id} type=${row.type}`);
  } catch (error) {
    console.error(`[worker] job ${row.id} failed`, error);
    await failJob(row, error);
  }
}

async function main() {
  console.log(`[worker] started ${WORKER_ID}`);
  while (true) {
    await tick();
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
