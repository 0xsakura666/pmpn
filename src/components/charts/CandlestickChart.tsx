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

interface CandlestickChartProps {
  data: CandleData[];
  volumeData?: VolumeData[];
  height?: number;
  onTimeRangeChange?: (from: Time, to: Time) => void;
}

export function CandlestickChart({
  data,
  volumeData,
  height = 400,
  onTimeRangeChange,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: "rgba(139, 148, 158, 0.2)",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    chartRef.current = chart;

    // Add candlestick series using v5 API
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00D4AA",
      downColor: "#FF6B6B",
      borderUpColor: "#00D4AA",
      borderDownColor: "#FF6B6B",
      wickUpColor: "#00D4AA",
      wickDownColor: "#FF6B6B",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series
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

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    // Time range change callback
    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          onTimeRangeChange(range.from as Time, range.to as Time);
        }
      });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height, onTimeRangeChange, volumeData]);

  // Update data
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  useEffect(() => {
    if (volumeSeriesRef.current && volumeData && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [volumeData]);

  // Show message if no data
  if (!data || data.length === 0) {
    return (
      <div 
        className="w-full flex items-center justify-center text-[hsl(var(--muted-foreground))]" 
        style={{ height }}
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
    <div ref={chartContainerRef} className="w-full" style={{ height }} />
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
