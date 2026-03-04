"use client";

import { useMemo } from "react";

interface VolumeChartProps {
  data: Array<{ time: string; volume: number }>;
  height?: number;
  className?: string;
}

export function VolumeChart({
  data,
  height = 100,
  className,
}: VolumeChartProps) {
  const { bars, maxVolume } = useMemo(() => {
    if (!data.length) return { bars: [], maxVolume: 0 };

    const volumes = data.map((d) => d.volume);
    const max = Math.max(...volumes);

    return {
      bars: data.map((d) => ({
        height: max > 0 ? (d.volume / max) * 100 : 0,
        volume: d.volume,
        time: d.time,
      })),
      maxVolume: max,
    };
  }, [data]);

  if (!data.length) {
    return (
      <div
        className={`flex items-center justify-center text-[var(--text-disabled)] ${className}`}
        style={{ height }}
      >
        暂无数据
      </div>
    );
  }

  const barWidth = 100 / bars.length;

  return (
    <div className={className} style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={i * barWidth + barWidth * 0.1}
            y={100 - bar.height}
            width={barWidth * 0.8}
            height={bar.height}
            fill="var(--brand-primary)"
            opacity={0.6 + (bar.height / 100) * 0.4}
          />
        ))}
      </svg>
    </div>
  );
}
