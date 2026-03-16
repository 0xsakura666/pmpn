"use client";

import { useState, useMemo } from "react";
import { CandlestickChart, type ChartMode } from "./CandlestickChart";
import {
  useMultiTimeframeCandles,
  aggregateCandlesToHigherTimeframe,
  INTERVAL_SECONDS,
  type CandleData,
  type IntervalType,
} from "@/hooks/useRealtimeCandles";
import { Time, CandlestickData } from "lightweight-charts";
import { TrendingUp, BarChart2 } from "lucide-react";
import { TIMEFRAME_TO_INTERVAL, type TimeframeType } from "@/lib/chart-timeframe";

interface RealtimeCandlestickChartProps {
  tokenId?: string;
  initialData?: CandlestickData<Time>[];
  historyBaseInterval?: IntervalType;
  height?: number;
  autoHeight?: boolean;
  defaultTimeframe?: TimeframeType;
  onTimeframeChange?: (tf: TimeframeType) => void;
  defaultChartMode?: ChartMode;
  allowedTimeframes?: TimeframeType[];
  enableRealtime?: boolean;
  compactMobile?: boolean;
}

const TIMEFRAME_CONFIG: Record<TimeframeType, { showSeconds: boolean; label: string }> = {
  "1S": { showSeconds: true, label: "1秒" },
  "5S": { showSeconds: true, label: "5秒" },
  "15S": { showSeconds: true, label: "15秒" },
  "1M": { showSeconds: false, label: "1分钟" },
  "5M": { showSeconds: false, label: "5分钟" },
  "15M": { showSeconds: false, label: "15分钟" },
  "1H": { showSeconds: false, label: "1小时" },
  "4H": { showSeconds: false, label: "4小时" },
  "1D": { showSeconds: false, label: "1天" },
};

const DEFAULT_VISIBLE_TIMEFRAMES: TimeframeType[] = ["1M", "5M", "15M", "1H", "4H"];

function formatPriceInt(value: number) {
  return `${Math.round(value * 100)}`;
}

function normalizeCandleTimeToSeconds(rawTime: Time): number | null {
  const numeric = Number(rawTime as unknown);
  if (!Number.isFinite(numeric)) return null;
  const normalized = numeric > 10_000_000_000
    ? Math.floor(numeric / 1000)
    : Math.floor(numeric);
  return normalized > 0 ? normalized : null;
}

function normalizeCandle(candle: CandlestickData<Time>): CandlestickData<Time> | null {
  const normalizedTime = normalizeCandleTimeToSeconds(candle.time);
  if (normalizedTime === null) return null;
  if (
    !Number.isFinite(candle.open) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low) ||
    !Number.isFinite(candle.close)
  ) {
    return null;
  }

  return {
    time: normalizedTime as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function mergeCandlesByTime(
  historicalCandles: CandlestickData<Time>[],
  realtimeCandles: CandlestickData<Time>[]
): CandlestickData<Time>[] {
  const byTime = new Map<number, CandlestickData<Time>>();

  historicalCandles.forEach((candle) => {
    byTime.set(candle.time as number, candle);
  });

  realtimeCandles.forEach((candle) => {
    byTime.set(candle.time as number, candle);
  });

  return Array.from(byTime.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

function getLatestCandleTime(candles: CandlestickData<Time>[]): number | null {
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1];
  return Number(last.time as unknown);
}

export function RealtimeCandlestickChart({
  tokenId,
  initialData = [],
  historyBaseInterval = "1m",
  height = 400,
  autoHeight,
  defaultTimeframe = "1M",
  onTimeframeChange,
  defaultChartMode = "candle",
  allowedTimeframes,
  enableRealtime = true,
  compactMobile = false,
}: RealtimeCandlestickChartProps) {
  const useAutoHeight = autoHeight || height === 0;
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>(defaultTimeframe);
  const visibleTimeframes = useMemo(() => {
    const source = allowedTimeframes && allowedTimeframes.length > 0 ? allowedTimeframes : DEFAULT_VISIBLE_TIMEFRAMES;
    return source.filter((tf, index) => source.indexOf(tf) === index);
  }, [allowedTimeframes]);
  const [chartMode, setChartMode] = useState<ChartMode>(defaultChartMode);

  const config = TIMEFRAME_CONFIG[selectedTimeframe];
  const currentInterval = TIMEFRAME_TO_INTERVAL[selectedTimeframe];

  const normalizedInitialData = useMemo(() => {
    return initialData
      .map(normalizeCandle)
      .filter((candle): candle is CandlestickData<Time> => candle !== null);
  }, [initialData]);

  const {
    isConnected,
    lastPrice,
    lastUpdate,
    getCandles: wsGetCandles,
    getCurrentCandle: wsGetCurrentCandle,
  } = useMultiTimeframeCandles({
    tokenId: tokenId || "",
    initialData: normalizedInitialData as CandleData[],
  });

  const historicalCandlesForInterval = useMemo(() => {
    if (normalizedInitialData.length === 0) return [];

    const targetSeconds = INTERVAL_SECONDS[currentInterval as IntervalType];
    const baseSeconds = INTERVAL_SECONDS[historyBaseInterval];

    if (targetSeconds < baseSeconds) {
      // Historical data cannot be safely downsampled below the fetched base interval.
      return [] as CandlestickData<Time>[];
    }

    if (currentInterval === historyBaseInterval) {
      return normalizedInitialData;
    }

    return aggregateCandlesToHigherTimeframe(
      normalizedInitialData as CandleData[],
      historyBaseInterval,
      currentInterval as IntervalType
    ) as CandlestickData<Time>[];
  }, [normalizedInitialData, currentInterval, historyBaseInterval]);

  const displayCurrentCandle = useMemo(() => {
    return wsGetCurrentCandle(currentInterval) as CandlestickData<Time> | null;
  }, [wsGetCurrentCandle, currentInterval, lastUpdate]);

  const displayCandles = useMemo(() => {
    const wsCandles = wsGetCandles(currentInterval) as CandlestickData<Time>[];
    const latestHistoricalTime = getLatestCandleTime(historicalCandlesForInterval);
    const currentRealtimeTime = displayCurrentCandle ? Number(displayCurrentCandle.time as unknown) : null;

    const finalizedRealtimeCandles = wsCandles.filter((candle) => {
      const candleTime = Number(candle.time as unknown);
      if (!Number.isFinite(candleTime)) return false;
      if (currentRealtimeTime !== null && candleTime === currentRealtimeTime) return false;
      if (latestHistoricalTime !== null && candleTime <= latestHistoricalTime) return false;
      return true;
    });

    if (historicalCandlesForInterval.length === 0) {
      return finalizedRealtimeCandles;
    }

    if (finalizedRealtimeCandles.length === 0) {
      return historicalCandlesForInterval;
    }

    return mergeCandlesByTime(historicalCandlesForInterval, finalizedRealtimeCandles);
  }, [wsGetCandles, currentInterval, lastUpdate, historicalCandlesForInterval, displayCurrentCandle]);

  const handleTimeframeChange = (tf: TimeframeType) => {
    setSelectedTimeframe(tf);
    onTimeframeChange?.(tf);
  };

  const candleStats = useMemo(() => {
    if (displayCandles.length === 0) return null;

    const first = displayCandles[0];
    const last = displayCandles[displayCandles.length - 1];
    const change = ((last.close - first.open) / first.open) * 100;
    const high = Math.max(...displayCandles.map(c => c.high));
    const low = Math.min(...displayCandles.map(c => c.low));

    return { change, high, low, lastClose: last.close };
  }, [displayCandles]);

  const movingAverageStats = useMemo(() => {
    const periods = [7, 25, 99];
    return periods.map((period) => {
      if (displayCandles.length < period) {
        return { period, value: null as number | null };
      }
      const slice = displayCandles.slice(-period);
      const value = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
      return { period, value };
    });
  }, [displayCandles]);

  return (
    <div className={`rounded-[24px] border border-[#232632] bg-[#15161c] ${useAutoHeight ? "h-full flex flex-col" : "space-y-0"}`}>
      <div className={`border-b border-[#232632] px-2.5 pt-2 ${useAutoHeight ? "shrink-0" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-3 text-[11px] font-medium text-[#8a8e99]">
              {visibleTimeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`border-b-2 px-0.5 pb-1 pt-0.5 whitespace-nowrap transition-all ${
                    selectedTimeframe === tf
                      ? "border-[#0ECB81] text-[#0ECB81]"
                      : "border-transparent hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-[#111319] p-0.5">
            <button
              onClick={() => setChartMode("line")}
              className={`rounded-full p-1.5 transition-all ${
                chartMode === "line" ? "bg-[#0ECB81] text-black" : "text-[#7d828d] hover:text-white"
              }`}
              title="线图"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setChartMode("candle")}
              className={`rounded-full p-1.5 transition-all ${
                chartMode === "candle" ? "bg-[#0ECB81] text-black" : "text-[#7d828d] hover:text-white"
              }`}
              title="K线图"
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-[10px] text-[#8a8e99]">
          <span className="text-[#c7cad1]">{config.label}</span>
          <span className={candleStats?.change && candleStats.change >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}>
            {candleStats ? `${candleStats.change >= 0 ? "+" : ""}${candleStats.change.toFixed(2)}%` : "--"}
          </span>
          <span>H <span className="font-mono text-white">{candleStats ? formatPriceInt(candleStats.high) : "--"}</span></span>
          <span>L <span className="font-mono text-white">{candleStats ? formatPriceInt(candleStats.low) : "--"}</span></span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "animate-pulse bg-[#0ECB81]" : "bg-[#F6465D]"}`} />
            {enableRealtime && isConnected ? "实时" : "静态"}
          </span>
        </div>

        {chartMode === "candle" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#232632] py-1.5 text-[10px]">
            {movingAverageStats.map(({ period, value }, index) => {
              const color = ["#F0B90B", "#C66BFF", "#8B949E"][index];
              return (
                <span key={period} style={{ color }}>
                  MA{period} <span className="font-mono">{value === null ? "--" : formatPriceInt(value)}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className={useAutoHeight ? "flex-1 min-h-0" : ""}>
        <CandlestickChart
          data={displayCandles}
          height={useAutoHeight ? 0 : height}
          autoHeight={useAutoHeight}
          currentCandle={displayCurrentCandle}
          showSeconds={config.showSeconds}
          isRealtime={Boolean(enableRealtime)}
          lastPrice={lastPrice}
          chartMode={chartMode}
          resetViewKey={`${selectedTimeframe}-${chartMode}`}
          accentColor="#0ECB81"
          bearishColor="#F6465D"
          showMovingAverages={chartMode === "candle"}
        />
      </div>

      {displayCurrentCandle && !compactMobile && (
        <div className={`border-t border-[#232632] px-3 py-2.5 ${useAutoHeight ? "shrink-0" : ""}`}>
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono text-[#8a8e99]">
            <span>O <span className="ml-1 text-white">{formatPriceInt(displayCurrentCandle.open)}</span></span>
            <span>H <span className="ml-1 text-[#0ECB81]">{formatPriceInt(displayCurrentCandle.high)}</span></span>
            <span>L <span className="ml-1 text-[#F6465D]">{formatPriceInt(displayCurrentCandle.low)}</span></span>
            <span>C <span className="ml-1 text-white">{formatPriceInt(displayCurrentCandle.close)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export { aggregateCandlesToHigherTimeframe };
