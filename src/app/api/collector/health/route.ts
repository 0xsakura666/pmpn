import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, hasDatabase } from "@/db";

type CollectorStatus = "ok" | "degraded" | "down" | "disabled";

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function GET() {
  if (!hasDatabase) {
    return NextResponse.json({
      status: "disabled" satisfies CollectorStatus,
      hasDatabase: false,
      summary: "DATABASE_URL 未配置，collector health 无法从数据库侧观测。",
    });
  }

  try {
    const [freshnessResult, recentResult, expiredResult] = await Promise.all([
      db.execute(sql`
        SELECT
          MAX(bucket_start) AS latest_bucket_start,
          MIN(bucket_start) AS earliest_bucket_start,
          COUNT(*)::int AS total_rows,
          COUNT(DISTINCT token_id)::int AS total_tokens
        FROM intraday_market_bars
        WHERE interval = '1s'
          AND (expires_at IS NULL OR expires_at >= NOW())
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE bucket_start >= NOW() - INTERVAL '5 minutes')::int AS rows_5m,
          COUNT(*) FILTER (WHERE bucket_start >= NOW() - INTERVAL '15 minutes')::int AS rows_15m,
          COUNT(*) FILTER (WHERE bucket_start >= NOW() - INTERVAL '60 minutes')::int AS rows_60m,
          COUNT(DISTINCT token_id) FILTER (WHERE bucket_start >= NOW() - INTERVAL '15 minutes')::int AS active_tokens_15m
        FROM intraday_market_bars
        WHERE interval = '1s'
          AND (expires_at IS NULL OR expires_at >= NOW())
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS expired_rows,
          MIN(expires_at) AS oldest_expired_at
        FROM intraday_market_bars
        WHERE expires_at IS NOT NULL
          AND expires_at < NOW()
      `),
    ]);

    const freshnessRow = freshnessResult.rows[0] ?? {};
    const recentRow = recentResult.rows[0] ?? {};
    const expiredRow = expiredResult.rows[0] ?? {};

    const latestBucketAt = toDate(freshnessRow.latest_bucket_start);
    const earliestBucketAt = toDate(freshnessRow.earliest_bucket_start);
    const oldestExpiredAt = toDate(expiredRow.oldest_expired_at);
    const now = Date.now();
    const lagSeconds = latestBucketAt ? Math.max(0, Math.floor((now - latestBucketAt.getTime()) / 1000)) : null;

    let status: CollectorStatus = "ok";
    if (!latestBucketAt) {
      status = "down";
    } else if (lagSeconds !== null && lagSeconds > 180) {
      status = "down";
    } else if (lagSeconds !== null && lagSeconds > 45) {
      status = "degraded";
    }

    return NextResponse.json({
      status,
      hasDatabase: true,
      freshness: {
        latestBucketAt: latestBucketAt?.toISOString() ?? null,
        earliestBucketAt: earliestBucketAt?.toISOString() ?? null,
        lagSeconds,
        totalRows: toNumber(freshnessRow.total_rows),
        totalTokens: toNumber(freshnessRow.total_tokens),
      },
      recent: {
        rows5m: toNumber(recentRow.rows_5m),
        rows15m: toNumber(recentRow.rows_15m),
        rows60m: toNumber(recentRow.rows_60m),
        activeTokens15m: toNumber(recentRow.active_tokens_15m),
      },
      cleanup: {
        expiredRows: toNumber(expiredRow.expired_rows),
        oldestExpiredAt: oldestExpiredAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Collector health API error:", error);
    return NextResponse.json(
      {
        status: "down" satisfies CollectorStatus,
        hasDatabase: true,
        error: error instanceof Error ? error.message : "Failed to inspect collector health",
      },
      { status: 500 }
    );
  }
}
