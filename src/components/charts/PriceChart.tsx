"use client";

import { useMemo } from "react";

interface PriceChartProps {
  data: Array<{ time: string; price: number }>;
  height?: number;
  color?: string;
  className?: string;
}

export function PriceChart({
  data,
  height = 200,
  color = "var(--brand-primary)",
  className,
}: PriceChartProps) {
  const { path, minPrice, maxPrice } = useMemo(() => {
    if (!data.length) return { path: "", minPrice: 0, maxPrice: 1 };

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const width = 100;
    const h = 100;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = h - ((d.price - min) / range) * h;
      return `${x},${y}`;
    });

    return {
      path: `M${points.join(" L")}`,
      minPrice: min,
      maxPrice: max,
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

  return (
    <div className={className} style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L100,100 L0,100 Z`}
          fill="url(#priceGradient)"
        />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs text-[var(--text-disabled)] mt-1">
        <span>${minPrice.toFixed(2)}</span>
        <span>${maxPrice.toFixed(2)}</span>
      </div>
    </div>
  );
}
