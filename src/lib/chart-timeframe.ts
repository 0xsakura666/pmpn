export type TimeframeType = "1S" | "5S" | "15S" | "1M" | "5M" | "15M" | "1H" | "4H" | "1D";

export type CandleInterval = "1s" | "5s" | "15s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const DEFAULT_TIMEFRAME: TimeframeType = "1M";

export const TIMEFRAME_TO_INTERVAL: Record<TimeframeType, CandleInterval> = {
  "1S": "1s",
  "5S": "5s",
  "15S": "15s",
  "1M": "1m",
  "5M": "5m",
  "15M": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
};

interface TimeframeHistoryConfig {
  interval: string;
  fidelity: number;
  historyInterval: CandleInterval;
  lookbackSeconds: number;
}

const TIMEFRAME_HISTORY_CONFIG: Record<TimeframeType, TimeframeHistoryConfig> = {
  "1S": { interval: "max", fidelity: 60, historyInterval: "1m", lookbackSeconds: 5 * 24 * 60 * 60 },
  "5S": { interval: "max", fidelity: 60, historyInterval: "1m", lookbackSeconds: 5 * 24 * 60 * 60 },
  "15S": { interval: "max", fidelity: 60, historyInterval: "1m", lookbackSeconds: 5 * 24 * 60 * 60 },
  "1M": { interval: "max", fidelity: 60, historyInterval: "1m", lookbackSeconds: 5 * 24 * 60 * 60 },
  "5M": { interval: "max", fidelity: 300, historyInterval: "5m", lookbackSeconds: 30 * 24 * 60 * 60 },
  "15M": { interval: "max", fidelity: 900, historyInterval: "15m", lookbackSeconds: 60 * 24 * 60 * 60 },
  "1H": { interval: "max", fidelity: 3600, historyInterval: "1h", lookbackSeconds: 180 * 24 * 60 * 60 },
  "4H": { interval: "max", fidelity: 14400, historyInterval: "4h", lookbackSeconds: 365 * 24 * 60 * 60 },
  "1D": { interval: "max", fidelity: 86400, historyInterval: "1d", lookbackSeconds: 5 * 365 * 24 * 60 * 60 },
};

export function normalizeTimeframe(
  value: string | null | undefined,
  fallback: TimeframeType = DEFAULT_TIMEFRAME
): TimeframeType {
  if (!value) return fallback;
  if (value in TIMEFRAME_TO_INTERVAL) return value as TimeframeType;
  return fallback;
}

export function getHistoryParamsForTimeframe(timeframe: TimeframeType): TimeframeHistoryConfig {
  return TIMEFRAME_HISTORY_CONFIG[timeframe] || TIMEFRAME_HISTORY_CONFIG[DEFAULT_TIMEFRAME];
}
