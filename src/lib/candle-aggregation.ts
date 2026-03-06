import type { CandleInterval } from "@/lib/chart-timeframe";

export interface PriceHistoryPoint {
  t: number;
  p: number;
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const CANDLE_INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1s": 1,
  "5s": 5,
  "15s": 15,
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export function normalizeHistoryPayload(data: unknown): PriceHistoryPoint[] {
  if (Array.isArray(data)) {
    return data as PriceHistoryPoint[];
  }

  if (data && typeof data === "object" && "history" in data) {
    const history = (data as { history?: unknown }).history;
    if (Array.isArray(history)) return history as PriceHistoryPoint[];
  }

  return [];
}

export function aggregatePriceHistoryToCandles(
  history: PriceHistoryPoint[],
  interval: CandleInterval
): CandlePoint[] {
  if (history.length === 0) return [];

  const intervalSeconds = CANDLE_INTERVAL_SECONDS[interval];
  const sorted = [...history].sort((a, b) => a.t - b.t);
  const grouped = new Map<number, CandlePoint>();

  for (const point of sorted) {
    const bucketTime = Math.floor(point.t / intervalSeconds) * intervalSeconds;
    const existing = grouped.get(bucketTime);

    if (!existing) {
      grouped.set(bucketTime, {
        time: bucketTime,
        open: point.p,
        high: point.p,
        low: point.p,
        close: point.p,
      });
      continue;
    }

    existing.high = Math.max(existing.high, point.p);
    existing.low = Math.min(existing.low, point.p);
    existing.close = point.p;
  }

  const sortedCandles = Array.from(grouped.values()).sort((a, b) => a.time - b.time);

  // For higher timeframes, fill empty buckets with flat candles so the
  // visual spacing remains strictly aligned to the selected interval.
  if (intervalSeconds >= 3600 && sortedCandles.length > 1) {
    const firstTime = sortedCandles[0].time;
    const lastTime = sortedCandles[sortedCandles.length - 1].time;
    const expectedBars = Math.floor((lastTime - firstTime) / intervalSeconds) + 1;

    // Guardrail: avoid creating too many synthetic bars on extremely long ranges.
    if (expectedBars <= 10000) {
      const byTime = new Map<number, CandlePoint>(
        sortedCandles.map((candle) => [candle.time, candle])
      );
      const filled: CandlePoint[] = [];
      let previousClose = sortedCandles[0].close;

      for (let time = firstTime; time <= lastTime; time += intervalSeconds) {
        const existing = byTime.get(time);
        if (existing) {
          filled.push(existing);
          previousClose = existing.close;
          continue;
        }

        filled.push({
          time,
          open: previousClose,
          high: previousClose,
          low: previousClose,
          close: previousClose,
        });
      }

      return filled;
    }
  }

  return sortedCandles;
}

export function candlesToHistory(candles: CandlePoint[]): PriceHistoryPoint[] {
  return candles.map((candle) => ({
    t: candle.time,
    p: candle.close,
  }));
}
