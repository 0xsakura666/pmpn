"use client";

import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--bg-muted)] text-[var(--text-muted)]",
        primary: "bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]",
        accent: "bg-[var(--brand-accent-muted)] text-[var(--brand-accent)]",
        success: "bg-[var(--color-up-muted)] text-[var(--color-up)]",
        error: "bg-[var(--color-down-muted)] text-[var(--color-down)]",
        warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
        outline: "border border-[var(--border-default)] text-[var(--text-muted)]",
      },
      size: {
        xs: "h-4 px-1 text-[10px] rounded",
        sm: "h-5 px-1.5 text-xs rounded-[var(--radius-sm)]",
        md: "h-6 px-2 text-xs rounded-[var(--radius-md)]",
        lg: "h-7 px-2.5 text-sm rounded-[var(--radius-md)]",
      },
      pill: {
        true: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  size,
  pill,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, pill }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
