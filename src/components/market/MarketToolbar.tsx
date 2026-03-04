"use client";

import { RefreshCw, LayoutGrid, List, Flame, BarChart3, Clock, Timer } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CATEGORIES, type SortOption, type ViewMode } from "./types";

const sortOptions: { value: SortOption; label: string; Icon: typeof Flame }[] = [
  { value: "Trending", label: "热门", Icon: Flame },
  { value: "Volume", label: "成交量", Icon: BarChart3 },
  { value: "Newest", label: "最新", Icon: Clock },
  { value: "Ending Soon", label: "即将结束", Icon: Timer },
];

interface MarketToolbarProps {
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  categoryCounts: Record<string, number>;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function MarketToolbar({
  categoryFilter,
  onCategoryChange,
  categoryCounts,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  isRefreshing,
  onRefresh,
}: MarketToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(({ value, label }) => {
          const count = categoryCounts[value] || 0;
          const isActive = categoryFilter === value;
          return (
            <button
              key={value}
              onClick={() => onCategoryChange(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-[var(--brand-primary)] text-black"
                  : "bg-[var(--bg-muted)] text-[var(--text-subtle)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn("text-xs", isActive ? "text-black/60" : "text-[var(--text-disabled)]")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort & View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          {sortOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => onSortChange(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-all",
                sortBy === value
                  ? "bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]"
                  : "text-[var(--text-disabled)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-muted)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isRefreshing && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--brand-primary)]">
              <RefreshCw className="h-3 w-3 animate-spin" />
              更新中
            </span>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="刷新">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <div className="h-5 w-px bg-[var(--border-default)]" />
          <div className="flex rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] p-0.5">
            <button
              onClick={() => onViewModeChange("card")}
              className={cn(
                "rounded-[var(--radius-md)] p-1.5 transition-colors",
                viewMode === "card" ? "bg-[var(--bg-muted)] text-[var(--text-primary)]" : "text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={cn(
                "rounded-[var(--radius-md)] p-1.5 transition-colors",
                viewMode === "list" ? "bg-[var(--bg-muted)] text-[var(--text-primary)]" : "text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
