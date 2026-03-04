"use client";

interface DistributionChartProps {
  yesPercent: number;
  noPercent?: number;
  showLabels?: boolean;
  height?: number;
  className?: string;
}

export function DistributionChart({
  yesPercent,
  noPercent,
  showLabels = true,
  height = 8,
  className,
}: DistributionChartProps) {
  const yes = Math.min(100, Math.max(0, yesPercent));
  const no = noPercent ?? 100 - yes;

  return (
    <div className={className}>
      <div
        className="w-full rounded-full overflow-hidden flex"
        style={{ height }}
      >
        <div
          className="bg-[var(--color-up)] transition-all duration-300"
          style={{ width: `${yes}%` }}
        />
        <div
          className="bg-[var(--color-down)] transition-all duration-300"
          style={{ width: `${no}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs mt-1">
          <span className="text-[var(--color-up)] font-medium">
            Yes {yes.toFixed(0)}%
          </span>
          <span className="text-[var(--color-down)] font-medium">
            No {no.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
