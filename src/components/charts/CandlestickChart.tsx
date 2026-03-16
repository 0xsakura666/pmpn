"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

export interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: Time;
  value: number;
  color?: string;
}

export type ChartMode = "candle" | "line";

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
  showMovingAverages?: boolean;
  accentColor?: string;
  bearishColor?: string;
}

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: "up" | "down" | "neutral";
}

function normalizeTimeToUtcSeconds(time: Time): number | null {
  const value = typeof time === "number" ? time : Number(time);
  if (!Number.isFinite(value)) return null;
  return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
}

function isValidNumericCandle(data: CandleData): boolean {
  const normalizedTime = normalizeTimeToUtcSeconds(data.time);
  return (
    normalizedTime !== null &&
    Number.isFinite(data.open) &&
    Number.isFinite(data.high) &&
    Number.isFinite(data.low) &&
    Number.isFinite(data.close)
  );
}

function buildMovingAverageSeries(candles: CandleData[], period: number): Array<{ time: Time; value: number }> {
  const result: Array<{ time: Time; value: number }> = [];
  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1);
    const average = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
    result.push({ time: candles[index].time, value: average });
  }
  return result;
}

function formatPriceInt(price: number): string {
  if (!Number.isFinite(price)) return "--";
  const cents = price * 100;
  return Number.isInteger(cents) ? `${cents}` : cents.toFixed(1).replace(/\.0$/, "");
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
  showMovingAverages = true,
  accentColor = "#0ECB81",
  bearishColor = "#F6465D",
}: CandlestickChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRefs = useRef<Array<ISeriesApi<"Line">>>([]);

  const getChartHeight = () => {
    if (autoHeight || height === 0) {
      return wrapperRef.current?.clientHeight || chartContainerRef.current?.clientHeight || 300;
    }
    return height;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!data || data.length === 0) return;

    const safeData = data.filter(isValidNumericCandle);
    if (safeData.length === 0) return;

    const priceScaleMargins = volumeData ? { top: 0.08, bottom: 0.22 } : { top: 0.08, bottom: 0.08 };
    const chartHeight = getChartHeight();
    const centsPriceFormat = {
      type: "price" as const,
      precision: 1,
      minMove: 0.001,
      formatter: (price: number) => formatPriceInt(price),
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8B949E",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255,255,255,0.16)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#14161d",
        },
        horzLine: {
          color: accentColor,
          width: 1,
          style: 2,
          labelBackgroundColor: accentColor,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: priceScaleMargins,
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: showSeconds,
        rightOffset: 4,
        barSpacing: 8,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
    });

    chartRef.current = chart;

    if (chartMode === "candle") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: accentColor,
        downColor: bearishColor,
        borderUpColor: accentColor,
        borderDownColor: bearishColor,
        wickUpColor: accentColor,
        wickDownColor: bearishColor,
        priceFormat: centsPriceFormat,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candlestickSeriesRef.current = candlestickSeries;
      candlestickSeries.setData(safeData);

      if (showMovingAverages) {
        const maPalette = ["#F0B90B", "#C66BFF", "#8B949E"];
        maSeriesRefs.current = [7, 25, 99].map((period, index) => {
          const series = chart.addSeries(LineSeries, {
            color: maPalette[index],
            lineWidth: period === 7 ? 2 : 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            priceFormat: centsPriceFormat,
          });
          series.setData(buildMovingAverageSeries(safeData, period));
          return series;
        });
      }
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: accentColor,
        topColor: "rgba(14, 203, 129, 0.28)",
        bottomColor: "rgba(14, 203, 129, 0.02)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: centsPriceFormat,
      });
      areaSeriesRef.current = areaSeries;
      areaSeries.setData(safeData.map((item) => ({ time: item.time, value: item.close })));
    }

    if (volumeData && volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: accentColor,
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: getChartHeight(),
      });
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) onTimeRangeChange(range.from as Time, range.to as Time);
      });
    }

    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      areaSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maSeriesRefs.current = [];
    };
  }, [
    data,
    volumeData,
    height,
    autoHeight,
    onTimeRangeChange,
    showSeconds,
    chartMode,
    showMovingAverages,
    accentColor,
    bearishColor,
  ]);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;
    chartRef.current.timeScale().fitContent();
  }, [resetViewKey, data.length, preferredVisibleBars]);

  useEffect(() => {
    if (!currentCandle || !chartRef.current) return;
    if (chartMode === "candle" && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.update(currentCandle);
    } else if (chartMode === "line" && areaSeriesRef.current) {
      areaSeriesRef.current.update({ time: currentCandle.time, value: currentCandle.close });
    }
  }, [currentCandle, chartMode]);

  const containerStyle = autoHeight || height === 0 ? { height: "100%", minHeight: 200 } : { height };

  if (!data || data.length === 0) {
    return (
      <div className="flex w-full items-center justify-center text-[hsl(var(--muted-foreground))]" style={containerStyle}>
        <div className="text-center">
          <div className="mb-2 text-2xl">📊</div>
          <p>暂无价格历史数据</p>
          <p className="mt-1 text-xs">市场可能是新创建的或交易量较低</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full min-h-0 overflow-hidden">
      {isRealtime && lastPrice !== null && lastPrice !== undefined && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded border border-[#333] bg-[#1a1a1f]/90 px-2 py-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#0ECB81]" />
          <span className="text-xs text-[#888]">实时</span>
          <span className="font-mono text-sm font-bold text-white">{formatPriceInt(lastPrice)}</span>
        </div>
      )}
      <div ref={chartContainerRef} className="h-full w-full" style={{ ...containerStyle, touchAction: "none" }} />
    </div>
  );
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

    const lineColor = color === "up" ? "#0ECB81" : color === "down" ? "#FF6B6B" : "#8B949E";
    const lineSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: `${lineColor}40`,
      bottomColor: `${lineColor}00`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    lineSeries.setData(
      data.map((value, index) => ({
        time: (index + 1) as Time,
        value,
      }))
    );
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, color]);

  return <div ref={chartContainerRef} style={{ width, height }} />;
}
