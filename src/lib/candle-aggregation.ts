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

interface AggregateOptions {
  fillMissingBuckets?: boolean;
  maxOutputBars?: number;
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
  interval: CandleInterval,
  options: AggregateOptions = {}
): CandlePoint[] {
  if (history.length === 0) return [];

  const { fillMissingBuckets = true, maxOutputBars = 5000 } = options;
  const intervalSeconds = CANDLE_INTERVAL_SECONDS[interval];
  const normalized = history
    .map((point) => {
      const rawTime = Number(point.t);
      const rawPrice = Number(point.p);
      if (!Number.isFinite(rawTime) || !Number.isFinite(rawPrice)) return null;

      const normalizedTime = rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime);
      if (normalizedTime <= 0) return null;

      return {
        t: normalizedTime,
        p: rawPrice,
      };
    })
    .filter((point): point is PriceHistoryPoint => point !== null);

  if (normalized.length === 0) return [];

  const sorted = [...normalized].sort((a, b) => a.t - b.t);
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
  if (sortedCandles.length === 0) return [];

  // Keep payload size bounded for both network and browser rendering cost.
  const lastTime = sortedCandles[sortedCandles.length - 1].time;
  const windowStart = Math.max(
    sortedCandles[0].time,
    lastTime - intervalSeconds * (Math.max(maxOutputBars, 1) - 1)
  );
  const windowedCandles = sortedCandles.filter((candle) => candle.time >= windowStart);

  if (!fillMissingBuckets || windowedCandles.length <= 1) {
    return windowedCandles;
  }

  const byTime = new Map<number, CandlePoint>(
    windowedCandles.map((candle) => [candle.time, candle])
  );
  const previousSlice = sortedCandles.slice(
    0,
    Math.max(sortedCandles.length - windowedCandles.length, 0)
  );
  const previousBeforeWindow =
    previousSlice.length > 0 ? previousSlice[previousSlice.length - 1] : undefined;

  const filled: CandlePoint[] = [];
  let previousClose = previousBeforeWindow?.close ?? windowedCandles[0].close;

  for (let time = windowStart; time <= lastTime; time += intervalSeconds) {
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

export function candlesToHistory(candles: CandlePoint[]): PriceHistoryPoint[] {
  return candles.map((candle) => ({
    t: candle.time,
    p: candle.close,
  }));
}
