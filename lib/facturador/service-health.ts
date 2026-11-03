import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { serviceOverride, serviceStatus, webhook, workerHeartbeat } from "@/lib/db/schema";
import { dispatchOrganizationWebhookEvent } from "@/lib/webhook-dispatch";

export type ServiceMode = "live" | "test";
export type HealthStatus = "operational" | "degraded" | "down";
export type ComponentName = "ingest" | "extraction" | "invoicing";

export type ComponentHealth = {
  status: HealthStatus;
  reason: string | null;
};

export type ServiceHealth = {
  object: "service_status";
  mode: ServiceMode;
  status: HealthStatus;
  components: Record<ComponentName, ComponentHealth>;
  /** Seconds a client should wait before trying again; null when operational. */
  retry_after_seconds: number | null;
  updated_at: string;
};

export const HEALTH_THRESHOLDS = {
  /** No worker poll within this window means extraction has stopped. */
  heartbeatStaleMs: 90_000,
  /** A due ticket waiting this long in the queue. */
  queueLagDegradedMs: 60_000,
  queueLagDownMs: 5 * 60_000,
  /** Recent provider outcomes used to measure invoicing. */
  outcomeWindowMs: 10 * 60_000,
  minOutcomeSamples: 3,
  failureRatioDegraded: 0.2,
  failureRatioDown: 0.5,
  retryAfterDownSeconds: 60,
  retryAfterDegradedSeconds: 30,
} as const;

/** Failures that say the service could not do its job, not that the ticket was wrong. */
export const INFRASTRUCTURE_FAILURE_CODES = [
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_INVALID_RESPONSE",
  "UPSTREAM_AUTH_ERROR",
  "UPSTREAM_RATE_LIMITED",
  "INSUFFICIENT_BALANCE",
  "PROVIDER_TIMEOUT",
] as const;

export type HealthOverride = {
  component: ComponentName;
  status: "degraded" | "down";
  reason: string;
};

export type HealthSignals = {
  databaseOk: boolean;
  /** Whether worker/provider signals apply. Sandbox tickets never reach them. */
  measured: boolean;
  lastHeartbeatAt: Date | null;
  oldestDueSubmitAt: Date | null;
  outcomes: { total: number; infrastructureFailures: number; rateLimited: number };
  overrides: HealthOverride[];
};

const SEVERITY: Record<HealthStatus, number> = { operational: 0, degraded: 1, down: 2 };

export const HEALTH_REASONS = {
  ingestDown: "No es posible registrar tickets en este momento.",
  extractionStopped: "El procesamiento de tickets está detenido.",
  extractionNoData: "No hay datos recientes del procesamiento de tickets.",
  extractionBacklogDown: "Los tickets no se están procesando.",
  extractionBacklogDegraded: "Los tickets están tardando más de lo normal en procesarse.",
  invoicingDown: "El servicio de facturación está fallando en la mayoría de las solicitudes recientes.",
  invoicingDegraded: "El servicio de facturación presenta fallas intermitentes.",
  invoicingRateLimited: "El servicio de facturación está limitando solicitudes.",
} as const;

function worse(a: ComponentHealth, b: ComponentHealth): ComponentHealth {
  return SEVERITY[b.status] > SEVERITY[a.status] ? b : a;
}

const OPERATIONAL: ComponentHealth = { status: "operational", reason: null };

export function computeServiceHealth(
  mode: ServiceMode,
  signals: HealthSignals,
  now = new Date()
): ServiceHealth {
  const components: Record<ComponentName, ComponentHealth> = {
    ingest: signals.databaseOk ? OPERATIONAL : { status: "down", reason: HEALTH_REASONS.ingestDown },
    extraction: OPERATIONAL,
    invoicing: OPERATIONAL,
  };

  if (signals.databaseOk && signals.measured) {
    if (!signals.lastHeartbeatAt) {
      components.extraction = { status: "degraded", reason: HEALTH_REASONS.extractionNoData };
    } else if (now.getTime() - signals.lastHeartbeatAt.getTime() > HEALTH_THRESHOLDS.heartbeatStaleMs) {
      components.extraction = { status: "down", reason: HEALTH_REASONS.extractionStopped };
    }
    if (signals.oldestDueSubmitAt) {
      const lag = now.getTime() - signals.oldestDueSubmitAt.getTime();
      if (lag > HEALTH_THRESHOLDS.queueLagDownMs) {
        components.extraction = worse(components.extraction, {
          status: "down",
          reason: HEALTH_REASONS.extractionBacklogDown,
        });
      } else if (lag > HEALTH_THRESHOLDS.queueLagDegradedMs) {
        components.extraction = worse(components.extraction, {
          status: "degraded",
          reason: HEALTH_REASONS.extractionBacklogDegraded,
        });
      }
    }

    const { total, infrastructureFailures, rateLimited } = signals.outcomes;
    if (total >= HEALTH_THRESHOLDS.minOutcomeSamples) {
      const ratio = infrastructureFailures / total;
      if (ratio >= HEALTH_THRESHOLDS.failureRatioDown) {
        components.invoicing = { status: "down", reason: HEALTH_REASONS.invoicingDown };
      } else if (ratio >= HEALTH_THRESHOLDS.failureRatioDegraded) {
        components.invoicing = { status: "degraded", reason: HEALTH_REASONS.invoicingDegraded };
      }
    }
    if (rateLimited > 0) {
      components.invoicing = worse(components.invoicing, {
        status: "degraded",
        reason: HEALTH_REASONS.invoicingRateLimited,
      });
    }
  }

  for (const override of signals.overrides) {
    components[override.component] = worse(components[override.component], {
      status: override.status,
      reason: override.reason,
    });
  }

  const status = (Object.values(components) as ComponentHealth[]).reduce(worse, OPERATIONAL).status;
  return {
    object: "service_status",
    mode,
    status,
    components,
    retry_after_seconds:
      status === "down"
        ? HEALTH_THRESHOLDS.retryAfterDownSeconds
        : status === "degraded"
          ? HEALTH_THRESHOLDS.retryAfterDegradedSeconds
          : null,
    updated_at: now.toISOString(),
  };
}

async function collectSignals(mode: ServiceMode, now: Date): Promise<HealthSignals> {
  const overrideRows = await db
    .select()
    .from(serviceOverride)
    .where(
      and(
        eq(serviceOverride.mode, mode),
        or(isNull(serviceOverride.expiresAt), gt(serviceOverride.expiresAt, now))
      )
    );
  const overrides = overrideRows.map((row) => ({
    component: row.component,
    status: row.status,
    reason: row.reason,
  }));

  if (mode === "test") {
    // Sandbox tickets are resolved by the mock provider, so only operator
    // overrides (e.g. switching extraction off for an integration test) apply.
    return {
      databaseOk: true,
      measured: false,
      lastHeartbeatAt: null,
      oldestDueSubmitAt: null,
      outcomes: { total: 0, infrastructureFailures: 0, rateLimited: 0 },
      overrides,
    };
  }

  const windowStart = new Date(now.getTime() - HEALTH_THRESHOLDS.outcomeWindowMs);
  const infraCodes = sql.join(
    INFRASTRUCTURE_FAILURE_CODES.map((code) => sql`${code}`),
    sql`, `
  );
  const [heartbeat, queue, outcomes] = await Promise.all([
    db.select({ lastSeenAt: sql<Date | null>`max(${workerHeartbeat.lastSeenAt})` }).from(workerHeartbeat),
    db.execute<{ oldest: Date | string | null }>(sql`
      select min(run_at) as oldest
      from job
      where type = 'submit_ticket' and status = 'pending' and run_at <= ${now}
    `),
    db.execute<{ total: number; infra: number; rate_limited: number }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where status = 'failed' and error_code in (${infraCodes}))::int as infra,
        count(*) filter (where error_code = 'UPSTREAM_RATE_LIMITED')::int as rate_limited
      from ticket
      where mode = 'live'
        and updated_at >= ${windowStart}
        and processing_started_at is not null
        and (provider_request_id is not null or status in ('failed', 'not_invoiceable', 'finalized'))
    `),
  ]);
  const toDate = (value: Date | string | null | undefined) =>
    value ? (value instanceof Date ? value : new Date(value)) : null;
  const row = outcomes.rows[0];

  return {
    databaseOk: true,
    measured: true,
    lastHeartbeatAt: toDate(heartbeat[0]?.lastSeenAt),
    oldestDueSubmitAt: toDate(queue.rows[0]?.oldest),
    outcomes: {
      total: row?.total ?? 0,
      infrastructureFailures: row?.infra ?? 0,
      rateLimited: row?.rate_limited ?? 0,
    },
    overrides,
  };
}

/** Measure availability now. Never throws: an unreachable database is reported as down. */
export async function measureServiceHealth(mode: ServiceMode, now = new Date()): Promise<ServiceHealth> {
  try {
    return computeServiceHealth(mode, await collectSignals(mode, now), now);
  } catch (error) {
    console.error("[service-health] could not collect health signals", error);
    return computeServiceHealth(
      mode,
      {
        databaseOk: false,
        measured: false,
        lastHeartbeatAt: null,
        oldestDueSubmitAt: null,
        outcomes: { total: 0, infrastructureFailures: 0, rateLimited: 0 },
        overrides: [],
      },
      now
    );
  }
}

const CACHE_TTL_MS = Number(process.env.SERVICE_HEALTH_CACHE_MS ?? 5_000);
const cache = new Map<ServiceMode, { at: number; value: Promise<ServiceHealth> }>();

/** Cached for a few seconds so the ticket intake path stays fast. */
export function getServiceHealth(mode: ServiceMode): Promise<ServiceHealth> {
  const hit = cache.get(mode);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = measureServiceHealth(mode);
  cache.set(mode, { at: Date.now(), value });
  return value;
}

export function clearServiceHealthCache() {
  cache.clear();
}

export function serviceEventForTransition(
  previous: HealthStatus,
  next: HealthStatus
): "service.degraded" | "service.down" | "service.recovered" | null {
  if (previous === next) return null;
  if (next === "down") return "service.down";
  if (next === "degraded") return "service.degraded";
  return "service.recovered";
}

/**
 * Persist the measured status and, when it changed, notify every organization
 * subscribed to the matching service.* event. Concurrent callers are
 * serialized by a row lock, so each transition is announced once.
 */
export async function publishServiceHealth(health: ServiceHealth) {
  const transition = await db.transaction(async (tx) => {
    await tx
      .insert(serviceStatus)
      .values({
        mode: health.mode,
        status: "operational",
        components: JSON.stringify({}),
      })
      .onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(serviceStatus)
      .where(eq(serviceStatus.mode, health.mode))
      .for("update");
    const previous = (current?.status ?? "operational") as HealthStatus;
    const changed = previous !== health.status;
    const now = new Date(health.updated_at);
    await tx
      .update(serviceStatus)
      .set({
        status: health.status,
        components: JSON.stringify(health.components),
        updatedAt: now,
        ...(changed ? { changedAt: now } : {}),
      })
      .where(eq(serviceStatus.mode, health.mode));
    return {
      previous,
      changed,
      since: changed ? now : (current?.changedAt ?? now),
    };
  });

  const eventType = serviceEventForTransition(transition.previous, health.status);
  if (!eventType) return { changed: false as const, health };

  const payload = {
    object: "service_status",
    status: health.status,
    previous_status: transition.previous,
    components: health.components,
    retry_after_seconds: health.retry_after_seconds,
    changed_at: transition.since.toISOString(),
    updated_at: health.updated_at,
  };
  const subscribers = await db
    .selectDistinct({ organizationId: webhook.organizationId })
    .from(webhook)
    .where(and(eq(webhook.enabled, true), sql`${eventType} = any(${webhook.events})`));
  await Promise.allSettled(
    subscribers.map((row) =>
      dispatchOrganizationWebhookEvent(row.organizationId, eventType, payload, {
        id: null,
        idempotencyKey: null,
        livemode: health.mode === "live",
      })
    )
  );
  console.log(
    `[service-health] mode=${health.mode} ${transition.previous} -> ${health.status} notified=${subscribers.length}`
  );
  return { changed: true as const, eventType, health };
}

export async function recordWorkerHeartbeat(workerId: string) {
  const now = new Date();
  await db
    .insert(workerHeartbeat)
    .values({ workerId, lastSeenAt: now, startedAt: now })
    .onConflictDoUpdate({ target: workerHeartbeat.workerId, set: { lastSeenAt: now } });
}

/** Drop heartbeats from processes that stopped long ago, keeping the table small. */
export async function pruneWorkerHeartbeats() {
  await db.execute(sql`delete from worker_heartbeat where last_seen_at < now() - interval '1 day'`);
}

export async function setServiceOverride(input: {
  mode: ServiceMode;
  component: ComponentName;
  status: "degraded" | "down";
  reason: string;
  expiresAt?: Date | null;
}) {
  await db
    .insert(serviceOverride)
    .values({ ...input, expiresAt: input.expiresAt ?? null })
    .onConflictDoUpdate({
      target: [serviceOverride.mode, serviceOverride.component],
      set: { status: input.status, reason: input.reason, expiresAt: input.expiresAt ?? null, createdAt: new Date() },
    });
  clearServiceHealthCache();
}

export async function clearServiceOverride(input: { mode: ServiceMode; component?: ComponentName }) {
  await db
    .delete(serviceOverride)
    .where(
      input.component
        ? and(eq(serviceOverride.mode, input.mode), eq(serviceOverride.component, input.component))
        : eq(serviceOverride.mode, input.mode)
    );
  clearServiceHealthCache();
}
