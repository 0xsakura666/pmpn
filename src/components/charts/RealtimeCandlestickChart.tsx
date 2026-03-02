"use client";

import { useState, useMemo } from "react";
import { CandlestickChart } from "./CandlestickChart";
import {
  useMultiTimeframeCandles,
  useSimulatedMultiTimeframeCandles,
  aggregateCandlesToHigherTimeframe,
  type CandleData,
  type IntervalType,
  INTERVAL_SECONDS,
} from "@/hooks/useRealtimeCandles";
import { Time, CandlestickData } from "lightweight-charts";

type TimeframeType = "1S" | "5S" | "15S" | "1M" | "5M" | "15M" | "1H" | "4H" | "1D";

interface RealtimeCandlestickChartProps {
  tokenId?: string;
  initialData?: CandlestickData<Time>[];
  height?: number;
  defaultTimeframe?: TimeframeType;
  onTimeframeChange?: (tf: TimeframeType) => void;
  enableSimulation?: boolean;
}

const TIMEFRAME_TO_INTERVAL: Record<TimeframeType, IntervalType> = {
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

export function RealtimeCandlestickChart({
  tokenId,
  initialData = [],
  height = 400,
  defaultTimeframe = "1M",
  onTimeframeChange,
  enableSimulation = false,
}: RealtimeCandlestickChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>(defaultTimeframe);

  const config = TIMEFRAME_CONFIG[selectedTimeframe];
  const currentInterval = TIMEFRAME_TO_INTERVAL[selectedTimeframe];

  const {
    isConnected: wsConnected,
    lastPrice: wsLastPrice,
    lastUpdate: wsLastUpdate,
    getCandles: wsGetCandles,
    getCurrentCandle: wsGetCurrentCandle,
    tickCount: wsTickCount,
  } = useMultiTimeframeCandles({
    tokenId: tokenId || "",
    initialData: initialData as CandleData[],
  });

  const {
    lastPrice: simLastPrice,
    lastUpdate: simLastUpdate,
    getCandles: simGetCandles,
    getCurrentCandle: simGetCurrentCandle,
    tickCount: simTickCount,
  } = useSimulatedMultiTimeframeCandles({
    initialPrice: initialData.length > 0 ? initialData[initialData.length - 1].close : 0.5,
    volatility: 0.002,
    updateInterval: 100,
  });

  const useSimulation = enableSimulation && !tokenId;
  const isConnected = useSimulation ? true : wsConnected;
  const lastPrice = useSimulation ? simLastPrice : wsLastPrice;
  const lastUpdate = useSimulation ? simLastUpdate : wsLastUpdate;
  const tickCount = useSimulation ? simTickCount : wsTickCount;

  const displayCandles = useMemo(() => {
    const getCandles = useSimulation ? simGetCandles : wsGetCandles;
    const candles = getCandles(currentInterval);
    
    if (candles.length === 0 && initialData.length > 0) {
      return initialData;
    }
    
    return candles as CandlestickData<Time>[];
  }, [useSimulation, simGetCandles, wsGetCandles, currentInterval, lastUpdate, initialData]);

  const displayCurrentCandle = useMemo(() => {
    const getCurrentCandle = useSimulation ? simGetCurrentCandle : wsGetCurrentCandle;
    return getCurrentCandle(currentInterval) as CandlestickData<Time> | null;
  }, [useSimulation, simGetCurrentCandle, wsGetCurrentCandle, currentInterval, lastUpdate]);

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
    <div className="space-y-3">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {/* Realtime Timeframes */}
          <div className="flex gap-0.5 p-1 bg-[#0d0d0f] rounded-lg">
            <span className="px-1.5 py-1 text-[10px] text-[#444] font-medium">实时</span>
            {REALTIME_TIMEFRAMES.map((tf) => (
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

        {/* Status */}
        <div className="flex items-center gap-3 text-xs">
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
          <span className="text-[#333]">|</span>
          <span className="text-[#555]">{displayCandles.length} K线</span>
          <span className="text-[#333]">|</span>
          <span className="text-[#555]">{tickCount} ticks</span>
        </div>
      </div>

      {/* Stats Bar */}
      {candleStats && (
        <div className="flex items-center gap-4 px-2 py-1.5 bg-[#0d0d0f] rounded-lg text-xs">
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
            <span className="font-mono text-[#00D4AA]">{candleStats.high.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666]">L:</span>
            <span className="font-mono text-[#FF6B6B]">{candleStats.low.toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <CandlestickChart
        data={displayCandles}
        height={height}
        currentCandle={displayCurrentCandle}
        showSeconds={config.showSeconds}
        isRealtime={true}
        lastPrice={lastPrice}
      />

      {/* Current Candle Info */}
      {displayCurrentCandle && (
        <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-[#0d0d0f]/50 rounded-lg">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-[#666]">当前K线</span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="text-[#666]">O:<span className="text-white ml-1">{displayCurrentCandle.open.toFixed(4)}</span></span>
            <span className="text-[#666]">H:<span className="text-[#00D4AA] ml-1">{displayCurrentCandle.high.toFixed(4)}</span></span>
            <span className="text-[#666]">L:<span className="text-[#FF6B6B] ml-1">{displayCurrentCandle.low.toFixed(4)}</span></span>
            <span className="text-[#666]">C:<span className="text-white ml-1">{displayCurrentCandle.close.toFixed(4)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export { aggregateCandlesToHigherTimeframe };
