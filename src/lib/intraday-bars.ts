import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { intradayMarketBars } from "@/db/schema";
import type { CandlePoint } from "@/lib/candle-aggregation";
import { CANDLE_INTERVAL_SECONDS } from "@/lib/candle-aggregation";
import type { CandleInterval, TimeframeType } from "@/lib/chart-timeframe";
import { getHistoryParamsForTimeframe } from "@/lib/chart-timeframe";

const SUPPORTED_INTRADAY_INTERVALS = new Set<TimeframeType>(["1S", "5S", "15S", "1M", "5M", "15M", "1H"]);

interface IntradayFetchOptions {
  timeframe: TimeframeType;
  startTs?: number;
  endTs?: number;
}

function toEpochSeconds(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ts = Math.floor(date.getTime() / 1000);
  return Number.isFinite(ts) ? ts : null;
}

function aggregateCandles(source: CandlePoint[], targetInterval: CandleInterval): CandlePoint[] {
  if (source.length === 0) return [];

  const targetSeconds = CANDLE_INTERVAL_SECONDS[targetInterval];
  const grouped = new Map<number, CandlePoint>();

  for (const candle of source) {
    const bucketTime = Math.floor(candle.time / targetSeconds) * targetSeconds;
    const existing = grouped.get(bucketTime);

    if (!existing) {
      grouped.set(bucketTime, {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }

  return Array.from(grouped.values()).sort((a, b) => a.time - b.time);
}

function fillMissingSeconds(candles: CandlePoint[], startTs: number, endTs: number): CandlePoint[] {
  if (candles.length === 0) return [];

  const byTime = new Map(candles.map((candle) => [candle.time, candle]));
  const filled: CandlePoint[] = [];
  let previousClose = candles[0].close;

  for (let ts = startTs; ts <= endTs; ts += 1) {
    const existing = byTime.get(ts);
    if (existing) {
      filled.push(existing);
      previousClose = existing.close;
    } else {
      filled.push({
        time: ts,
        open: previousClose,
        high: previousClose,
        low: previousClose,
        close: previousClose,
      });
    }
  }

  return filled;
}

export function supportsIntradayCollector(timeframe: TimeframeType): boolean {
  return SUPPORTED_INTRADAY_INTERVALS.has(timeframe);
}

export async function getIntradayCandles(
  tokenId: string,
  options: IntradayFetchOptions
): Promise<CandlePoint[]> {
  const { timeframe, startTs, endTs } = options;
  if (!tokenId || !supportsIntradayCollector(timeframe)) return [];

  const historyConfig = getHistoryParamsForTimeframe(timeframe);
  const nowSec = Math.floor(Date.now() / 1000);
  const resolvedEndTs = endTs ?? nowSec;
  const resolvedStartTs = startTs ?? Math.max(nowSec - historyConfig.lookbackSeconds, nowSec - 36 * 60 * 60);

  const rows = await db
    .select({
      bucketStart: intradayMarketBars.bucketStart,
      open: intradayMarketBars.open,
      high: intradayMarketBars.high,
      low: intradayMarketBars.low,
      close: intradayMarketBars.close,
    })
    .from(intradayMarketBars)
    .where(
      and(
        eq(intradayMarketBars.tokenId, tokenId),
        eq(intradayMarketBars.interval, "1s"),
        gte(intradayMarketBars.bucketStart, new Date(resolvedStartTs * 1000)),
        lte(intradayMarketBars.bucketStart, new Date(resolvedEndTs * 1000))
      )
    )
    .orderBy(asc(intradayMarketBars.bucketStart));

  if (!rows.length) return [];

  const baseCandles = rows
    .map((row) => {
      const time = toEpochSeconds(row.bucketStart);
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const close = Number(row.close);

      if (
        time === null ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        return null;
      }

      return { time, open, high, low, close } satisfies CandlePoint;
    })
    .filter((row): row is CandlePoint => row !== null);

  if (!baseCandles.length) return [];

  const firstTime = baseCandles[0].time;
  const lastTime = baseCandles[baseCandles.length - 1].time;
  const filledBase = fillMissingSeconds(baseCandles, Math.max(firstTime, resolvedStartTs), Math.min(lastTime, resolvedEndTs));

  if (historyConfig.historyInterval === "1s") {
    return filledBase;
  }

  return aggregateCandles(filledBase, historyConfig.historyInterval);
}
