"use server";

import { and, eq, gte, sql } from "drizzle-orm";

import { requestLog } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { requireActiveOrganization } from "@/app/lib/auth";
import type {
  Granularity,
  LatencyPoint,
  OverviewStats,
  RequestVolumePoint,
  StatusMixPoint,
} from "@/app/lib/overview";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_FILL: Record<string, string> = {
  "2xx": "var(--chart-1)",
  "4xx": "var(--chart-3)",
  "5xx": "var(--chart-5)",
};

// Bucketing config per granularity. All date math happens in Postgres (which
// runs in UTC here) so bucket boundaries and labels stay in one timezone —
// avoiding a mismatch with the app server's local timezone.
const GRANULARITY_CONFIG: Record<
  Granularity,
  { trunc: string; step: string; startOffset: string; fmt: string }
> = {
  hour: { trunc: "hour", step: "1 hour", startOffset: "23 hours", fmt: "HH24:00" },
  day: { trunc: "day", step: "1 day", startOffset: "13 days", fmt: "YYYY-MM-DD" },
  week: { trunc: "week", step: "1 week", startOffset: "11 weeks", fmt: "YYYY-MM-DD" },
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const { organization } = await requireActiveOrganization();
  const since = new Date(Date.now() - DAY_MS);

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      errorCount: sql<number>`(count(*) filter (where status >= 400))::int`,
      avgLatencyMs: sql<number>`coalesce(avg(latency_ms), 0)::int`,
    })
    .from(requestLog)
    .where(
      and(
        eq(requestLog.organizationId, organization.id),
        gte(requestLog.timestamp, since)
      )
    );

  const total = row?.total ?? 0;
  const errorCount = row?.errorCount ?? 0;
  return {
    requests24h: total,
    errorCount24h: errorCount,
    errorRate24h: total > 0 ? Math.round((errorCount / total) * 100) : 0,
    avgLatencyMs24h: row?.avgLatencyMs ?? 0,
  };
}

export async function getStatusMix24h(): Promise<StatusMixPoint[]> {
  const { organization } = await requireActiveOrganization();
  const since = new Date(Date.now() - DAY_MS);

  const rows = await db
    .select({
      bucket: sql<string>`case when status < 400 then '2xx' when status < 500 then '4xx' else '5xx' end`,
      count: sql<number>`count(*)::int`,
    })
    .from(requestLog)
    .where(
      and(
        eq(requestLog.organizationId, organization.id),
        gte(requestLog.timestamp, since)
      )
    )
    .groupBy(
      sql`case when status < 400 then '2xx' when status < 500 then '4xx' else '5xx' end`
    );

  return rows
    .filter((r) => r.count > 0)
    .map((r) => ({
      status: r.bucket,
      count: r.count,
      fill: STATUS_FILL[r.bucket] ?? "var(--chart-1)",
    }));
}

/**
 * Time-series volume + latency for the chosen granularity. Volume is zero-filled
 * across the full window (via a generated bucket series) so the area chart shows
 * the whole timeline; latency returns only buckets that have traffic, since a
 * 0 ms percentile would be misleading.
 */
export async function getTimeSeries(
  granularity: Granularity
): Promise<{ volume: RequestVolumePoint[]; latency: LatencyPoint[] }> {
  const { organization } = await requireActiveOrganization();
  const g = GRANULARITY_CONFIG[granularity];

  const volumeResult = await db.execute<{ date: string; requests: number }>(sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc(${g.trunc}, now() - (${g.startOffset})::interval),
        date_trunc(${g.trunc}, now()),
        (${g.step})::interval
      ) AS bucket_start
    )
    SELECT to_char(b.bucket_start, ${g.fmt}) AS date,
           count(rl.id)::int AS requests
    FROM buckets b
    LEFT JOIN request_log rl
      ON rl.organization_id = ${organization.id}
      AND rl.timestamp >= b.bucket_start
      AND rl.timestamp < b.bucket_start + (${g.step})::interval
    GROUP BY b.bucket_start, to_char(b.bucket_start, ${g.fmt})
    ORDER BY b.bucket_start
  `);

  const latencyResult = await db.execute<{ date: string; p50: number; p95: number }>(sql`
    SELECT to_char(bucket, ${g.fmt}) AS date,
           percentile_cont(0.5) within group (order by latency_ms) AS p50,
           percentile_cont(0.95) within group (order by latency_ms) AS p95
    FROM (
      SELECT date_trunc(${g.trunc}, "timestamp") AS bucket, latency_ms
      FROM request_log
      WHERE organization_id = ${organization.id}
        AND "timestamp" >= date_trunc(${g.trunc}, now() - (${g.startOffset})::interval)
    ) t
    GROUP BY bucket
    ORDER BY bucket
  `);

  return {
    volume: volumeResult.rows.map((r) => ({ date: r.date, requests: r.requests })),
    latency: latencyResult.rows.map((r) => ({
      date: r.date,
      p50: Math.round(r.p50),
      p95: Math.round(r.p95),
    })),
  };
}
