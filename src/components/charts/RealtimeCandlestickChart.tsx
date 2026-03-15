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

const REALTIME_TIMEFRAMES: TimeframeType[] = ["1S", "5S", "15S", "1M"];
const HIGHER_TIMEFRAMES: TimeframeType[] = ["5M", "15M", "1H", "4H", "1D"];
const PREFERRED_VISIBLE_BARS: Record<TimeframeType, number> = {
  "1S": 180,
  "5S": 180,
  "15S": 160,
  "1M": 120,
  "5M": 120,
  "15M": 96,
  "1H": 72,
  "4H": 60,
  "1D": 60,
};

function formatUsd(value: number, precision = 3) {
  return `$${value.toFixed(precision)}`;
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
}: RealtimeCandlestickChartProps) {
  const useAutoHeight = autoHeight || height === 0;
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>(defaultTimeframe);
  const visibleRealtimeTimeframes = (allowedTimeframes || REALTIME_TIMEFRAMES).filter((tf) => REALTIME_TIMEFRAMES.includes(tf));
  const visibleHigherTimeframes = (allowedTimeframes || HIGHER_TIMEFRAMES).filter((tf) => HIGHER_TIMEFRAMES.includes(tf));
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
    tickCount,
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
    
    return { change, high, low };
  }, [displayCandles]);

  return (
    <div className={`${useAutoHeight ? "h-full flex flex-col" : "space-y-3"}`}>
      {/* Timeframe Selector */}
      <div className={`flex flex-col gap-2 ${useAutoHeight ? "shrink-0 mb-2" : ""} sm:flex-row sm:items-center sm:justify-between`}>
        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1">
            {/* Realtime Timeframes */}
            <div className="flex gap-0.5 p-1 bg-[#0d0d0f] rounded-lg">
            <span className="px-1.5 py-1 text-[10px] text-[#444] font-medium">实时</span>
            {visibleRealtimeTimeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  selectedTimeframe === tf
                    ? "bg-[#00D4AA] text-black shadow-lg shadow-[#00D4AA]/20"
                    : "text-[#666] hover:text-white hover:bg-[#2a2a2f]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

            {/* Higher Timeframes */}
            <div className="flex gap-0.5 p-1 bg-[#0d0d0f] rounded-lg">
              <span className="px-1.5 py-1 text-[10px] text-[#444] font-medium">聚合</span>
              {HIGHER_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    selectedTimeframe === tf
                      ? "bg-[#7B61FF] text-white shadow-lg shadow-[#7B61FF]/20"
                      : "text-[#666] hover:text-white hover:bg-[#2a2a2f]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Mode Toggle & Status */}
        <div className="flex items-center justify-between gap-2 text-xs sm:justify-end">
          {/* Chart Mode Toggle */}
          <div className="flex gap-0.5 p-1 bg-[#0d0d0f] rounded-lg">
            <button
              onClick={() => setChartMode("line")}
              className={`p-1.5 rounded transition-all ${
                chartMode === "line"
                  ? "bg-[#00D4AA] text-black"
                  : "text-[#666] hover:text-white hover:bg-[#2a2a2f]"
              }`}
              title="实时线图"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartMode("candle")}
              className={`p-1.5 rounded transition-all ${
                chartMode === "candle"
                  ? "bg-[#7B61FF] text-white"
                  : "text-[#666] hover:text-white hover:bg-[#2a2a2f]"
              }`}
              title="K线图"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <span className="text-[#333]">|</span>
          
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-[#00D4AA] animate-pulse" : "bg-[#FF6B6B]"
              }`}
            />
            <span className="text-[#666]">
              {isConnected ? "实时" : "离线"}
            </span>
          </div>
          <span className="hidden sm:inline text-[#333]">|</span>
          <span className="hidden sm:inline text-[#555]">{displayCandles.length} {chartMode === "candle" ? "K线" : "点"}</span>
          <span className="hidden sm:inline text-[#333]">|</span>
          <span className="hidden sm:inline text-[#555]">{tickCount} ticks</span>
        </div>
      </div>

      {/* Stats Bar */}
      {candleStats && (
        <div className={`grid grid-cols-2 gap-2 px-2 py-1.5 bg-[#0d0d0f] rounded-lg text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-4 ${useAutoHeight ? "shrink-0 mb-2" : ""}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666]">周期:</span>
            <span className="text-white font-medium">{config.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666]">涨跌:</span>
            <span className={`font-mono font-medium ${candleStats.change >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
              {candleStats.change >= 0 ? "+" : ""}{candleStats.change.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666]">H:</span>
            <span className="font-mono text-[#00D4AA]">{formatUsd(candleStats.high, 3)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666]">L:</span>
            <span className="font-mono text-[#FF6B6B]">{formatUsd(candleStats.low, 3)}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className={useAutoHeight ? "flex-1 min-h-0" : ""}>
        <CandlestickChart
          data={displayCandles}
          height={useAutoHeight ? 0 : height}
          autoHeight={useAutoHeight}
          currentCandle={displayCurrentCandle}
          showSeconds={config.showSeconds}
          isRealtime={true}
          lastPrice={lastPrice}
          chartMode={chartMode}
          resetViewKey={`${selectedTimeframe}-${chartMode}`}
        />
      </div>

      {/* Current Candle Info */}
      {displayCurrentCandle && (
        <div className={`rounded-lg bg-[#0d0d0f]/50 px-2 py-1.5 text-xs ${useAutoHeight ? "shrink-0 mt-2" : ""}`}>
          <div className="mb-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-[#666]">当前K线</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <span className="text-[#666]">O:<span className="text-white ml-1">{formatUsd(displayCurrentCandle.open, 3)}</span></span>
            <span className="text-[#666]">H:<span className="text-[#00D4AA] ml-1">{formatUsd(displayCurrentCandle.high, 3)}</span></span>
            <span className="text-[#666]">L:<span className="text-[#FF6B6B] ml-1">{formatUsd(displayCurrentCandle.low, 3)}</span></span>
            <span className="text-[#666]">C:<span className="text-white ml-1">{formatUsd(displayCurrentCandle.close, 3)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export { aggregateCandlesToHigherTimeframe };
