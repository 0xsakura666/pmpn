"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavItems, isActiveRoute } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[var(--z-fixed)] border-t border-[var(--border-default)] bg-[var(--bg-base)]/95 backdrop-blur-md md:hidden">
      <div className="flex h-[var(--mobile-nav-height)] items-center justify-around px-2">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[var(--radius-lg)] transition-all",
                isActive
                  ? "text-[var(--brand-primary)]"
                  : "text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_var(--brand-primary)]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      <div className="fixed left-0 top-[var(--header-height)] bottom-[var(--mobile-nav-height)] w-64 z-[var(--z-modal)] bg-[var(--bg-elevated)] border-r border-[var(--border-default)] p-4 md:hidden overflow-y-auto animate-in slide-in-from-left duration-200">
        <nav className="space-y-1">
          {mobileNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] transition-all",
                  isActive
                    ? "bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
