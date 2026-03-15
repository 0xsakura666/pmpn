"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: Time;
  value: number;
  color: string;
}

export type ChartMode = "line" | "candle";

interface CandlestickChartProps {
  data: CandleData[];
  volumeData?: VolumeData[];
  height?: number;
  autoHeight?: boolean;
  onTimeRangeChange?: (from: Time, to: Time) => void;
  currentCandle?: CandleData | null;
  showSeconds?: boolean;
  isRealtime?: boolean;
  lastPrice?: number | null;
  chartMode?: ChartMode;
  resetViewKey?: string;
  preferredVisibleBars?: number;
}

function formatPriceInt(value: number) {
  return `${Math.round(value * 100)}`;
}

function normalizeTimeToUtcSeconds(rawTime: Time): number | null {
  const numeric = Number(rawTime as unknown);
  if (!Number.isFinite(numeric)) return null;

  let ts = numeric;
  // Defensive normalization: if any source accidentally passes milliseconds,
  // convert to seconds so lightweight-charts receives UTCTimestamp.
  if (ts > 10_000_000_000) {
    ts = ts / 1000;
  }

  const normalized = Math.floor(ts);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return normalized;
}

function isValidNumericCandle(data: CandleData): boolean {
  const normalizedTime = normalizeTimeToUtcSeconds(data.time);
  const t = data.time as number;
  return (
    normalizedTime !== null &&
    typeof t === "number" &&
    Number.isFinite(data.open) &&
    Number.isFinite(data.high) &&
    Number.isFinite(data.low) &&
    Number.isFinite(data.close)
  );
}

export function CandlestickChart({
  data,
  volumeData,
  height = 400,
  autoHeight = false,
  onTimeRangeChange,
  currentCandle,
  showSeconds = false,
  isRealtime = false,
  lastPrice,
  chartMode = "candle",
  resetViewKey,
  preferredVisibleBars = 120,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const isInitializedRef = useRef(false);

  const getChartHeight = () => {
    if (autoHeight || height === 0) {
      return chartContainerRef.current?.parentElement?.clientHeight || 300;
    }
    return height;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartHeight = getChartHeight();
    const priceScaleMargins = volumeData
      ? { top: 0.08, bottom: 0.22 }
      : { top: 0.08, bottom: 0.08 };
    const centsPriceFormat = {
      type: "custom" as const,
      minMove: 0.0001,
      formatter: (price: number) => formatPriceInt(price),
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8B949E",
      },
      grid: {
        vertLines: { color: "rgba(139, 148, 158, 0.1)" },
        horzLines: { color: "rgba(139, 148, 158, 0.1)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#7B61FF",
          width: 1,
          style: 2,
          labelBackgroundColor: "#7B61FF",
        },
        horzLine: {
          color: "#7B61FF",
          width: 1,
          style: 2,
          labelBackgroundColor: "#7B61FF",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(139, 148, 158, 0.2)",
        scaleMargins: priceScaleMargins,
      },
      timeScale: {
        borderColor: "rgba(139, 148, 158, 0.2)",
        timeVisible: true,
        secondsVisible: showSeconds,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
    });

    chartRef.current = chart;

    if (chartMode === "candle") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#00D4AA",
        downColor: "#FF6B6B",
        borderUpColor: "#00D4AA",
        borderDownColor: "#FF6B6B",
        wickUpColor: "#00D4AA",
        wickDownColor: "#FF6B6B",
        priceFormat: centsPriceFormat,
      });
      candlestickSeriesRef.current = candlestickSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: "#00D4AA",
        topColor: "rgba(0, 212, 170, 0.3)",
        bottomColor: "rgba(0, 212, 170, 0.02)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: centsPriceFormat,
      });
      areaSeriesRef.current = areaSeries;
    }

    if (volumeData) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#7B61FF",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        const newHeight = autoHeight || height === 0
          ? chartContainerRef.current.parentElement?.clientHeight || 300
          : height;
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: newHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    
    if (autoHeight || height === 0) {
      const resizeObserver = new ResizeObserver(handleResize);
      if (chartContainerRef.current.parentElement) {
        resizeObserver.observe(chartContainerRef.current.parentElement);
      }
    }

    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          onTimeRangeChange(range.from as Time, range.to as Time);
        }
      });
    }

    isInitializedRef.current = true;

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      candlestickSeriesRef.current = null;
      areaSeriesRef.current = null;
      isInitializedRef.current = false;
    };
  }, [height, autoHeight, onTimeRangeChange, volumeData, showSeconds, chartMode]);

  useEffect(() => {
    if (data.length === 0) return;

    const safeData = data
      .filter(isValidNumericCandle)
      .map((d) => ({
        ...d,
        time: normalizeTimeToUtcSeconds(d.time) as Time,
      }));

    if (safeData.length === 0) return;
    
    try {
      if (chartMode === "candle" && candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(safeData);
        if (!isRealtime) {
          chartRef.current?.timeScale().fitContent();
        }
      } else if (chartMode === "line" && areaSeriesRef.current) {
        const lineData = safeData.map(d => ({ time: d.time, value: d.close }));
        areaSeriesRef.current.setData(lineData);
        if (!isRealtime) {
          chartRef.current?.timeScale().fitContent();
        }
      }
    } catch (error) {
      console.error("[CandlestickChart] setData failed", {
        error,
        mode: chartMode,
        sampleTimes: safeData.slice(0, 5).map((d) => d.time),
      });
    }
  }, [data, isRealtime, chartMode]);

  useEffect(() => {
    if (currentCandle && isRealtime) {
      if (!isValidNumericCandle(currentCandle)) return;
      const normalizedTime = normalizeTimeToUtcSeconds(currentCandle.time);
      if (normalizedTime === null) return;
      const safeCurrent = {
        ...currentCandle,
        time: normalizedTime as Time,
      };
      try {
        if (chartMode === "candle" && candlestickSeriesRef.current) {
          candlestickSeriesRef.current.update(safeCurrent);
        } else if (chartMode === "line" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: safeCurrent.time, value: safeCurrent.close });
        }
      } catch (error) {
        console.error("[CandlestickChart] update failed", {
          error,
          mode: chartMode,
          time: safeCurrent.time,
        });
      }
    }
  }, [currentCandle, isRealtime, chartMode]);

  useEffect(() => {
    if (volumeSeriesRef.current && volumeData && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [volumeData]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0) return;
    chartRef.current.timeScale().fitContent();
  }, [resetViewKey, data.length]);

  const containerStyle = autoHeight || height === 0 
    ? { height: "100%", minHeight: 200 } 
    : { height };

  if (!data || data.length === 0) {
    return (
      <div 
        className="w-full flex items-center justify-center text-[hsl(var(--muted-foreground))]" 
        style={containerStyle}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <p>暂无价格历史数据</p>
          <p className="text-xs mt-1">市场可能是新创建的或交易量较低</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isRealtime && lastPrice !== null && lastPrice !== undefined && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-2 py-1 rounded bg-[#1a1a1f]/90 border border-[#333]">
          <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
          <span className="text-xs text-[#888]">实时</span>
          <span className="text-sm font-mono font-bold text-white">
            {formatPriceInt(lastPrice)}
          </span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full" style={containerStyle} />
    </div>
  );
}

// Mini sparkline chart for market cards
interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: "up" | "down" | "neutral";
}

export function SparklineChart({
  data,
  width = 100,
  height = 40,
  color = "neutral",
}: SparklineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { mode: CrosshairMode.Hidden },
      handleScale: false,
      handleScroll: false,
      width,
      height,
    });

    const lineColor =
      color === "up" ? "#00D4AA" : color === "down" ? "#FF6B6B" : "#7B61FF";

    const lineSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: `${lineColor}40`,
      bottomColor: `${lineColor}00`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const chartData = data.map((value, index) => ({
      time: (index + 1) as Time,
      value,
    }));

    lineSeries.setData(chartData);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, color]);

  return <div ref={chartContainerRef} style={{ width, height }} />;
}
