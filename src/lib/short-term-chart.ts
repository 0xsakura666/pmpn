import type { TimeframeType } from "@/lib/chart-timeframe";

const SHORT_TERM_WINDOW_MS = 48 * 60 * 60 * 1000;

export function getHoursUntil(endDate?: string | null): number | null {
  if (!endDate) return null;
  const ts = new Date(endDate).getTime();
  if (!Number.isFinite(ts)) return null;
  return (ts - Date.now()) / 3600000;
}

export function isShortTermChartMarket(endDate?: string | null): boolean {
  const hours = getHoursUntil(endDate);
  if (hours === null) return false;
  return hours <= 48;
}

export function getRecommendedChartTimeframe(endDate?: string | null): TimeframeType {
  const hours = getHoursUntil(endDate);
  if (hours === null) return "1M";
  if (hours <= 6) return "15S";
  if (hours <= 24) return "1M";
  if (hours <= 48) return "5M";
  return "15M";
}

export function getShortTermStartTs(endDate: string | null | undefined, timeframe: TimeframeType): number | undefined {
  if (!isShortTermChartMarket(endDate)) return undefined;

  const lookbackSecondsByTimeframe: Record<TimeframeType, number> = {
    "1S": 30 * 60,
    "5S": 2 * 60 * 60,
    "15S": 6 * 60 * 60,
    "1M": 24 * 60 * 60,
    "5M": 48 * 60 * 60,
    "15M": 72 * 60 * 60,
    "1H": 7 * 24 * 60 * 60,
    "4H": 30 * 24 * 60 * 60,
    "1D": 365 * 24 * 60 * 60,
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const lookbackSeconds = lookbackSecondsByTimeframe[timeframe];
  const marketEndTs = Math.floor(new Date(endDate!).getTime() / 1000);
  const floorByMarketLifetime = Math.max(nowSec - lookbackSeconds, marketEndTs - Math.floor(SHORT_TERM_WINDOW_MS / 1000));

  return Math.max(0, floorByMarketLifetime);
}
