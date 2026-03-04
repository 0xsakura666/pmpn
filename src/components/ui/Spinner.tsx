"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  color?: "primary" | "white" | "muted";
}

const sizeClasses = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-2",
};

const colorClasses = {
  primary: "border-[var(--brand-primary)] border-t-transparent",
  white: "border-white border-t-transparent",
  muted: "border-[var(--text-muted)] border-t-transparent",
};

export function Spinner({ size = "md", className, color = "primary" }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full",
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    />
  );
}

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16",
        className
      )}
    >
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-[var(--border-default)]" />
        <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[var(--brand-primary)]" />
      </div>
      {message && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">{message}</span>
          <span className="flex gap-1">
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
