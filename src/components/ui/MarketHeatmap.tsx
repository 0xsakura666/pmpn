"use client";

import { useMemo } from "react";

interface HeatmapCell {
  id: string;
  title: string;
  category: string;
  volume: number;
  change: number;
  whaleVolume: number;
  retailVolume: number;
}

interface MarketHeatmapProps {
  data: HeatmapCell[];
  groupBy?: "category" | "none";
  onCellClick?: (cell: HeatmapCell) => void;
}

export function MarketHeatmap({
  data,
  groupBy = "category",
  onCellClick,
}: MarketHeatmapProps) {
  const grouped = useMemo(() => {
    if (groupBy === "none") return { All: data };
    
    return data.reduce((acc, cell) => {
      const key = cell.category || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(cell);
      return acc;
    }, {} as Record<string, HeatmapCell[]>);
  }, [data, groupBy]);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, cells]) => (
        <div key={category}>
          {groupBy !== "none" && (
            <h4 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] mb-2">
              {category}
            </h4>
          )}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {cells.map((cell) => (
              <HeatmapCellComponent
                key={cell.id}
                cell={cell}
                onClick={() => onCellClick?.(cell)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapCellComponent({
  cell,
  onClick,
}: {
  cell: HeatmapCell;
  onClick: () => void;
}) {
  const intensity = Math.min(Math.abs(cell.change) / 20, 1);
  const isPositive = cell.change >= 0;
  
  const bgColor = isPositive
    ? `rgba(0, 212, 170, ${0.1 + intensity * 0.4})`
    : `rgba(255, 107, 107, ${0.1 + intensity * 0.4})`;
  
  const borderColor = isPositive
    ? `rgba(0, 212, 170, ${0.3 + intensity * 0.4})`
    : `rgba(255, 107, 107, ${0.3 + intensity * 0.4})`;

  return (
    <div
      onClick={onClick}
      className="aspect-square p-2 rounded-lg cursor-pointer transition-all hover:scale-105"
      style={{
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
      }}
    >
      <div className="h-full flex flex-col justify-between">
        <p className="text-xs font-medium line-clamp-2 leading-tight">
          {cell.title.length > 30 ? cell.title.slice(0, 30) + "..." : cell.title}
        </p>
        <div>
          <span
            className={`text-lg font-bold ${
              isPositive ? "text-[var(--up)]" : "text-[var(--down)]"
            }`}
          >
            {isPositive ? "+" : ""}{cell.change.toFixed(1)}%
          </span>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            ${formatVolume(cell.volume)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlowIndicator({
  whaleVolume,
  retailVolume,
}: {
  whaleVolume: number;
  retailVolume: number;
}) {
  const total = whaleVolume + retailVolume;
  const whalePercent = total > 0 ? (whaleVolume / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--whale)]">🐋 巨鲸 {whalePercent.toFixed(0)}%</span>
        <span className="text-[hsl(var(--muted-foreground))]">
          散户 {(100 - whalePercent).toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-[var(--whale)] to-[#8B5CF6] transition-all duration-500"
          style={{ width: `${whalePercent}%` }}
        />
        <div
          className="h-full bg-[hsl(var(--muted-foreground))] transition-all duration-500"
          style={{ width: `${100 - whalePercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span>${formatVolume(whaleVolume)}</span>
        <span>${formatVolume(retailVolume)}</span>
      </div>
    </div>
  );
}

export function CategoryHeatBar({
  categories,
}: {
  categories: { name: string; volume: number; change: number }[];
}) {
  const totalVolume = categories.reduce((sum, c) => sum + c.volume, 0);

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const widthPercent = (cat.volume / totalVolume) * 100;
        const isPositive = cat.change >= 0;

        return (
          <div key={cat.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{cat.name}</span>
              <span
                className={isPositive ? "text-[var(--up)]" : "text-[var(--down)]"}
              >
                {isPositive ? "+" : ""}{cat.change.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isPositive
                    ? "bg-gradient-to-r from-[var(--up)] to-[var(--up)]/60"
                    : "bg-gradient-to-r from-[var(--down)] to-[var(--down)]/60"
                }`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              ${formatVolume(cat.volume)} 成交量
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatVolume(volume: number) {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toFixed(0);
}
