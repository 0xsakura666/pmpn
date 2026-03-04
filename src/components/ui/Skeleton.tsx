"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "circular" | "text";
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({
  className,
  variant = "default",
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClasses =
    "animate-pulse bg-gradient-to-r from-[var(--bg-muted)] via-[var(--bg-subtle)] to-[var(--bg-muted)] bg-[length:200%_100%]";

  const variantClasses = {
    default: "rounded-[var(--radius-md)]",
    circular: "rounded-full",
    text: "rounded h-4",
  };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  if (count === 1) {
    return (
      <div
        className={cn(baseClasses, variantClasses[variant], className)}
        style={style}
      />
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(baseClasses, variantClasses[variant], className)}
          style={style}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4",
        className
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <Skeleton variant="circular" width={32} height={32} />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} className="w-full" />
          <Skeleton height={16} className="w-2/3" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton height={16} className="w-24" />
          <div className="flex gap-1">
            <Skeleton height={24} className="w-12 rounded-[var(--radius-md)]" />
            <Skeleton height={24} className="w-12 rounded-[var(--radius-md)]" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton height={16} className="w-20" />
          <div className="flex gap-1">
            <Skeleton height={24} className="w-12 rounded-[var(--radius-md)]" />
            <Skeleton height={24} className="w-12 rounded-[var(--radius-md)]" />
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
        <Skeleton height={12} className="w-28" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_100px_100px_100px_140px] items-center gap-4 px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={28} height={28} />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} className="w-3/4" />
          <Skeleton height={12} className="w-1/3" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton height={16} className="w-14" />
        <Skeleton height={6} className="rounded-full" />
      </div>
      <Skeleton height={16} className="w-14 ml-auto" />
      <Skeleton height={16} className="w-14 ml-auto" />
      <div className="flex justify-end gap-2">
        <Skeleton height={28} className="w-16 rounded-[var(--radius-lg)]" />
        <Skeleton height={28} className="w-16 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}
